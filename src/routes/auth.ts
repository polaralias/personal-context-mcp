import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db';
import { createLogger, getRequestId } from '../logger';

const router = Router();
const logger = createLogger('routes:auth');

// POST /authorize
router.post('/authorize', async (req: Request, res: Response) => {
    try {
        const { callbackUrl, state, connectionUrl, config } = req.body;

        if (!callbackUrl) {
            return res.status(400).json({ error: 'callbackUrl is required' });
        }

        try {
            new URL(callbackUrl);
        } catch {
            return res.status(400).json({ error: 'Invalid callbackUrl' });
        }

        const code = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 60 * 1000); // 1 minute expiration

        // Create the session immediately but don't expose it yet
        const token = crypto.randomUUID();
        await prisma.clientSession.create({
            data: {
                token,
                connectionUrl,
                config: config || {},
                expiresAt: new Date(Date.now() + 3600 * 1000 * 24 * 30) // 30 days
            }
        });

        await prisma.authCode.create({
            data: {
                code,
                callbackUrl,
                state: state || null,
                expiresAt,
                sessionToken: token
            }
        });

        // Construct redirect URL
        const redirectUrl = new URL(callbackUrl);
        redirectUrl.searchParams.append('code', code);
        if (state) {
            redirectUrl.searchParams.append('state', state);
        }

        res.json({ redirectUrl: redirectUrl.toString() });

    } catch (error) {
        logger.error({ err: error, requestId: getRequestId(req) }, 'authorize failed');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /token
router.post('/token', async (req: Request, res: Response) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        const authCode = await prisma.authCode.findUnique({
            where: { code }
        });

        if (!authCode) {
            return res.status(400).json({ error: 'Invalid code' });
        }

        if (authCode.expiresAt < new Date()) {
             // Clean up
             await prisma.authCode.delete({ where: { code } });
             return res.status(400).json({ error: 'Code expired' });
        }

        // Invalidate code immediately (single use)
        await prisma.authCode.delete({
            where: { code }
        });

        res.json({
            access_token: authCode.sessionToken,
            token_type: 'Bearer',
            expires_in: 3600 * 24 * 30 // match session expiry
        });

    } catch (error) {
        logger.error({ err: error, requestId: getRequestId(req) }, 'token exchange failed');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
