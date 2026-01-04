import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger';
import { verifyToken, getConnection, decryptConfig, validateApiKey } from '../services/auth';

const logger = createLogger('middleware:mcpAuth');

// Extend Request type to include mcpConfig
declare global {
    namespace Express {
        interface Request {
            mcpConfig?: any;
        }
    }
}

export const authenticateMcp = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'] as string;
    const apiKeyQuery = req.query.apiKey as string;

    // 1. Check for Bearer Token
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const connectionId = verifyToken(token);

        if (!connectionId) {
            logger.warn({ ip: req.ip }, 'Invalid Bearer token');
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        try {
            const connection = await getConnection(connectionId);
            if (!connection) {
                logger.warn({ ip: req.ip, connectionId }, 'Connection not found for token');
                return res.status(401).json({ error: 'Unauthorized: Connection not found' });
            }

            const config = decryptConfig(connection.configEncrypted);
            req.mcpConfig = config;
            return next();
        } catch (error) {
            logger.error({ err: error }, 'Error authenticating with Bearer token');
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // 2. Check for API Key
    const providedApiKey = apiKeyHeader || apiKeyQuery;
    if (providedApiKey) {
        if (validateApiKey(providedApiKey)) {
            // API key is valid. Set default empty config if connection-specific config is not applicable.
            req.mcpConfig = {};
            return next();
        } else {
            logger.warn({ ip: req.ip }, 'Invalid API key provided');
            return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
        }
    }

    // 3. No auth provided
    logger.warn({ ip: req.ip }, 'Missing authentication credentials');
    return res.status(401).json({ error: 'Unauthorized: Authentication required (Bearer token or x-api-key)' });
};
