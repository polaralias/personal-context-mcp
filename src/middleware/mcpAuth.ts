import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger';
import { verifyToken, getConnection, decryptConfig, validateApiKey } from '../services/auth';
import { mcpRateLimiter } from '../utils/rateLimit';
import { ApiKeyService } from '../services/apiKeyService';

const logger = createLogger('middleware:mcpAuth');
const apiKeyService = ApiKeyService.getInstance();

// Extend Request type to include mcpConfig
declare global {
    namespace Express {
        interface Request {
            mcpConfig?: any;
        }
    }
}

const getBaseUrl = (req: Request): string => {
    if (process.env.BASE_URL) return process.env.BASE_URL;

    const protocol = req.protocol || 'http';
    const host = req.get('host') || req.headers.host || 'localhost';
    return `${protocol}://${host}`;
};

const setOauthDiscoveryHeader = (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.set('WWW-Authenticate', `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`);
};

const unauthorized = (req: Request, res: Response, error: string) => {
    setOauthDiscoveryHeader(req, res);
    return res.status(401).json({ error });
};

export const authenticateMcp = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'] as string;
    const apiKeyQuery = req.query.apiKey as string;

    let candidateKey: string | null = null;
    let isBearer = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        candidateKey = authHeader.slice(7);
        isBearer = true;
    } else if (apiKeyHeader) {
        candidateKey = apiKeyHeader;
    } else if (apiKeyQuery) {
        candidateKey = apiKeyQuery;
    }

    if (candidateKey) {
        // 1. Check User Bound Key (sk_mcp_)
        if (candidateKey.startsWith('sk_mcp_')) {
            if (process.env.API_KEY_MODE === 'user_bound') {
                if (!mcpRateLimiter.check(candidateKey)) {
                    logger.warn({ ip: req.ip }, 'Rate limit exceeded for key');
                    return res.status(429).json({ error: 'Too Many Requests' });
                }

                const result = await apiKeyService.validateKey(candidateKey, req.ip || 'unknown');
                if (result) {
                    req.mcpConfig = result.config;
                    return next();
                } else {
                    // Invalid user key
                    logger.warn({ ip: req.ip }, 'Invalid User-Bound API key');
                    return unauthorized(req, res, 'Unauthorized: Invalid API key');
                }
            }
        }

        // 2. Check OAuth (Bearer only)
        if (isBearer) {
            const connectionId = verifyToken(candidateKey);
            if (connectionId) {
                try {
                    const connection = await getConnection(connectionId);
                    if (connection) {
                        const config = decryptConfig(connection.configEncrypted);
                        req.mcpConfig = config;
                        return next();
                    }
                } catch (error) {
                    logger.error({ err: error }, 'Error authenticating with Bearer token');
                }
            }
        }

        // 3. Check Global API Key (Fallback)
        if (validateApiKey(candidateKey)) {
            req.mcpConfig = {};
            return next();
        }
    }

    // No valid auth found
    if (candidateKey) {
        // We had a key but it failed all checks
        logger.warn({ ip: req.ip }, 'Invalid authentication credentials');
        return unauthorized(req, res, 'Unauthorized: Invalid credentials');
    }

    // No auth provided
    logger.warn({ ip: req.ip }, 'Missing authentication credentials');
    return unauthorized(req, res, 'Unauthorized: Authentication required (Bearer token or x-api-key)');
};
