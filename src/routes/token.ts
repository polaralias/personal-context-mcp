import express, { Request, Response } from 'express';
import { findAndValidateAuthCode, markAuthCodeUsed, signToken, verifyPkce } from '../services/auth';
import { createLogger } from '../logger';

const router = express.Router();
const logger = createLogger('routes:token');

router.post('/', async (req: Request, res: Response) => {
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
