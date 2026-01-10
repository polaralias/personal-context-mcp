import express, { Request, Response } from 'express';
import { createClient } from '../services/auth';
import { createLogger } from '../logger';

const router = express.Router();
const logger = createLogger('routes:register');

// In-memory rate limiting for /register
const registerRateLimit = new Map<string, { count: number; timestamp: number }>();
const REGISTER_WINDOW_MS = 60 * 1000;
const REGISTER_MAX_REQUESTS = 10;

const checkRateLimit = (req: Request): boolean => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const limit = registerRateLimit.get(ip);

    if (!limit) {
        registerRateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (now - limit.timestamp > REGISTER_WINDOW_MS) {
        registerRateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (limit.count >= REGISTER_MAX_REQUESTS) {
        return false;
    }

    limit.count++;
    return true;
};

router.post('/', async (req: Request, res: Response) => {
    if (!checkRateLimit(req)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    const { redirect_uris, client_name } = req.body;

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
        return res.status(400).json({ error: 'redirect_uris is required and must be an array' });
    }

    // Validate URIs
    const allowList = process.env.REDIRECT_URI_ALLOWLIST ? process.env.REDIRECT_URI_ALLOWLIST.split(',') : [];
    const mode = process.env.REDIRECT_URI_ALLOWLIST_MODE || 'prefix';

    for (const uri of redirect_uris) {
        if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
             return res.status(400).json({ error: 'redirect_uris must be http or https' });
        }

        if (allowList.length > 0) {
            let allowed = false;
            for (const allowedUri of allowList) {
                if (mode === 'exact') {
                    if (uri === allowedUri.trim()) allowed = true;
                } else {
                    if (uri.startsWith(allowedUri.trim())) allowed = true;
                }
            }
            if (!allowed) {
                logger.warn({ event: 'register_rejected', uri, ip: req.ip }, 'Redirect URI not in allowlist');
                return res.status(400).json({ error: 'One or more redirect_uris are not allowed' });
            }
        }
    }

    try {
        const client = await createClient(client_name, redirect_uris);
        res.status(201).json({
            client_id: client.clientId,
            client_name: client.clientName,
            redirect_uris: client.redirectUris,
            token_endpoint_auth_method: client.tokenEndpointAuthMethod
        });
    } catch (error) {
        logger.error({ err: error }, 'Client registration failed');
        res.status(500).json({ error: 'server_error' });
    }
});

export default router;
