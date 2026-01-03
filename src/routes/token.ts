import express, { Request, Response } from 'express';
import { findAndValidateAuthCode, markAuthCodeUsed, signToken, verifyPkce } from '../services/auth';
import { createLogger } from '../logger';

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
    // Apply rate limit
    if (!checkTokenRateLimit(req)) {
        return res.status(429).json({ error: 'too_many_requests', error_description: 'Rate limit exceeded' });
    }

    // Support JSON and URL-encoded
    const { grant_type, code, code_verifier, redirect_uri } = req.body;

    if (grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    if (!code || !code_verifier || !redirect_uri) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'Missing required parameters' });
    }

    try {
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
