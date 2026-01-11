import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { createLogger } from '../logger';
import { getConnection, decryptConfig, validateApiKey, hashString } from '../services/auth';
import prisma from '../db';
import { mcpRateLimiter } from '../utils/rateLimit';

const logger = createLogger('middleware:mcpAuth');

// Extend Request type to include mcpConfig
declare global {
    namespace Express {
        interface Request {
            mcpConfig?: any;
        }
    }
}

const unauthorized = (res: Response, error: string) => {
    return res.status(401).json({ error });
};

// Simplified Verify Token Helper (Access Token)
const verifyAccessToken = async (token: string): Promise<string | null> => {
    // Token format: <sessionId>:<secret>
    const parts = token.split(':');
    if (parts.length !== 2) return null;

    const [sessionId, secret] = parts;
    if (!sessionId || !secret) return null;

    try {
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { connection: true }
        });

        if (!session) return null;
        if (session.revoked) return null;
        if (session.expiresAt < new Date()) return null;

        // Verify hash (bcrypt)
        const valid = await bcrypt.compare(secret, session.tokenHash);
        if (!valid) return null;

        return session.connectionId;
    } catch (e) {
        return null;
    }
};

export const authenticateMcp = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'] as string;
    const apiKeyQuery = req.query.apiKey as string;
    const apiKeyParam = req.params.apiKey as string;


    let candidateKey: string | null = null;
    let isBearer = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        candidateKey = authHeader.slice(7);
        isBearer = true;
    } else if (apiKeyHeader) {
        candidateKey = apiKeyHeader;
    } else if (apiKeyQuery) {
        candidateKey = apiKeyQuery;
    } else if (apiKeyParam) {
        candidateKey = apiKeyParam;
    }

    if (candidateKey) {
        // 1. Check User Bound Key (mcp_sk_)
        if (candidateKey.startsWith('mcp_sk_')) {
            if (!mcpRateLimiter.check(candidateKey)) {
                logger.warn({ ip: req.ip }, 'Rate limit exceeded for key');
                return res.status(429).json({ error: 'Too Many Requests' });
            }

            const keyHash = hashString(candidateKey);
            try {
                const apiKey = await prisma.apiKey.findUnique({
                    where: { keyHash },
                    include: { userConfig: true }
                });

                // Check if revoked (either key or config)
                if (apiKey && !apiKey.revokedAt) {
                    // Decrypt config
                    const config = decryptConfig(apiKey.userConfig.configEnc);
                    req.mcpConfig = config;

                    // Async update last used
                    prisma.apiKey.update({
                        where: { id: apiKey.id },
                        data: { lastUsedAt: new Date() }
                    }).catch(() => { });

                    return next();
                }
            } catch (e) {
                logger.error({ err: e }, 'Error validating user key');
            }
        }

        // 2. Check OAuth / Session (Bearer only)
        if (isBearer) {
            const connectionId = await verifyAccessToken(candidateKey);
            if (connectionId) {
                try {
                    const connection = await getConnection(connectionId);
                    if (connection) {
                        // Merge public config and decrypted secrets
                        const secrets = decryptConfig(connection.encryptedSecrets);
                        const config = { ...(connection.config as object), ...secrets };
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
        logger.warn({ ip: req.ip }, 'Invalid authentication credentials');
        return unauthorized(res, 'Invalid API key');
    }

    logger.warn({ ip: req.ip }, 'Missing authentication credentials');
    return unauthorized(res, 'Authentication required');
};
