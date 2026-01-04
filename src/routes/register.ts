import express, { Request, Response } from 'express';
import { createRegisteredClient } from '../services/auth';
import { createLogger } from '../logger';

const router = express.Router();
const logger = createLogger('routes:register');

// In-memory rate limiting for /register
const registerRateLimit = new Map<string, { count: number; timestamp: number }>();
const REGISTER_WINDOW_MS = 60 * 1000; // 1 minute
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
        // Reset window
        registerRateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (limit.count >= REGISTER_MAX_REQUESTS) {
        return false;
    }

    limit.count++;
    return true;
};

// Redirect URI Validation Helper
const validateRedirectUris = (uris: string[]): boolean => {
    if (!uris || uris.length === 0) return false;

    const allowListStr = process.env.REDIRECT_URI_ALLOWLIST || '';
    const allowList = allowListStr.split(',').map(u => u.trim()).filter(u => u.length > 0);
    const mode = process.env.REDIRECT_URI_ALLOWLIST_MODE || 'exact';

    for (const uri of uris) {
        try {
            const parsed = new URL(uri);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return false;
            }
        } catch {
            return false;
        }

        // If allowlisting exists, enforcement is mandatory
        if (allowList.length > 0) {
            let allowed = false;
            if (mode === 'prefix') {
                allowed = allowList.some(a => uri.startsWith(a));
            } else {
                allowed = allowList.includes(uri);
            }
            if (!allowed) return false;
        }
    }

    return true;
};

router.post('/', async (req: Request, res: Response) => {
    if (!checkRateLimit(req)) {
        return res.status(429).json({ error: 'too_many_requests' });
    }

    const {
        redirect_uris,
        client_name,
        token_endpoint_auth_method,
        grant_types,
        response_types,
        scope
    } = req.body;

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
        return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required and must be a non-empty array' });
    }

    if (!validateRedirectUris(redirect_uris)) {
        // B4: Rejection logging
        logger.warn({
            event: 'redirect_uri_rejected',
            rejected_uris: redirect_uris,
            client_name,
            path: '/register',
            ip: req.ip
        }, 'Redirect URI rejected by allowlist');

        // B5: User-facing error message
        return res.status(400).json({
            error: 'invalid_redirect_uri',
            error_description: "This client isn't in the redirect allow list - raise an issue on GitHub for it to be added"
        });
    }

    try {
        const client = await createRegisteredClient({
            clientName: client_name,
            redirectUris: redirect_uris,
            tokenEndpointAuthMethod: token_endpoint_auth_method,
            grantTypes: grant_types,
            responseTypes: response_types,
            scope: scope
        });

        res.status(201).json({
            client_id: client.id,
            client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
            client_name: client.clientName,
            redirect_uris: client.redirectUris,
            token_endpoint_auth_method: client.tokenEndpointAuthMethod,
            grant_types: client.grantTypes,
            response_types: client.responseTypes,
            scope: client.scope
        });
    } catch (error) {
        logger.error({ err: error }, 'Error registering client');
        res.status(500).json({ error: 'server_error' });
    }
});

export default router;
