import express, { Request, Response } from 'express';
import { findAndValidateAuthCode, markAuthCodeUsed, signToken, verifyPkce, getRegisteredClient } from '../services/auth';
import { createLogger } from '../logger';
import { hasMasterKey } from '../utils/masterKey';

const router = express.Router();
const logger = createLogger('routes:token');

// In-memory rate limiting for /token
const tokenRateLimit = new Map<string, { count: number; timestamp: number }>();
const TOKEN_WINDOW_MS = 60 * 1000; // 1 minute
const TOKEN_MAX_REQUESTS = 10;

const checkTokenRateLimit = (req: Request): boolean => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const limit = tokenRateLimit.get(ip);

    if (!limit) {
        tokenRateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (now - limit.timestamp > TOKEN_WINDOW_MS) {
        // Reset window
        tokenRateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (limit.count >= TOKEN_MAX_REQUESTS) {
        return false;
    }

    limit.count++;
    return true;
};

router.post('/', async (req: Request, res: Response) => {
    if (!hasMasterKey()) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'Token generation blocked: MASTER_KEY is missing.' });
    }
    // Apply rate limit
    if (!checkTokenRateLimit(req)) {
        return res.status(429).json({ error: 'too_many_requests', error_description: 'Rate limit exceeded' });
    }

    // Support JSON and URL-encoded
    const { grant_type, code, code_verifier, redirect_uri, client_id, client_secret } = req.body;

    if (grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    if (!code || !code_verifier || !redirect_uri || !client_id) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'Missing required parameters' });
    }

    try {
        const registeredClient = await getRegisteredClient(client_id);
        if (!registeredClient) {
            return res.status(400).json({ error: 'invalid_client', error_description: 'Invalid client_id' });
        }

        // ChatGPT uses "none" (public client)
        if (registeredClient.tokenEndpointAuthMethod !== 'none') {
            // If we wanted to support confidential clients, we would check client_secret here.
            // For now, if it's not "none", we require a secret (but DCR defaults to none).
            if (!client_secret) {
                return res.status(401).json({ error: 'invalid_client', error_description: 'Client secret required for this client' });
            }
            // Simple secret check (if we stored it) - but we don't store it yet.
        }

        const authCode = await findAndValidateAuthCode(code);

        if (!authCode) {
            logger.warn('Invalid or expired auth code attempt');
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired code' });
        }

        if (authCode.redirectUri !== redirect_uri) {
            logger.warn({ expected: authCode.redirectUri, actual: redirect_uri }, 'Redirect URI mismatch');
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' });
        }

        if (!verifyPkce(code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
            logger.warn('PKCE verification failed');
            return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
        }

        // Mark used
        await markAuthCodeUsed(authCode.id);

        // Issue Token
        const token = signToken(authCode.connectionId);
        const expiresIn = parseInt(process.env.TOKEN_TTL_SECONDS || '3600');

        res.json({
            access_token: token,
            token_type: 'Bearer',
            expires_in: expiresIn
        });

    } catch (error) {
        logger.error({ err: error }, 'Error in token exchange');
        res.status(500).json({ error: 'server_error' });
    }
});

export default router;
