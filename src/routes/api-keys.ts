import express, { Request, Response } from 'express';
import { createUserBoundKey } from '../services/auth';
import { createLogger } from '../logger';
import { hasMasterKey } from '../utils/masterKey';

const router = express.Router();
const logger = createLogger('routes:api-keys');

// In-memory rate limiting
const issueRateLimit = new Map<string, { count: number; timestamp: number }>();
const ISSUE_WINDOW_MS = parseInt(process.env.API_KEY_ISSUE_WINDOW_SECONDS || '3600') * 1000;
const ISSUE_MAX_REQUESTS = parseInt(process.env.API_KEY_ISSUE_RATELIMIT || '3');

const checkRateLimit = (req: Request): boolean => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const limit = issueRateLimit.get(ip);

    if (!limit) {
        issueRateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (now - limit.timestamp > ISSUE_WINDOW_MS) {
        issueRateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (limit.count >= ISSUE_MAX_REQUESTS) {
        return false;
    }

    limit.count++;
    return true;
};

router.post('/', async (req: Request, res: Response) => {
    if (process.env.API_KEY_MODE !== 'user_bound') {
        return res.status(404).json({ error: 'User-bound API keys are disabled' });
    }

    if (!hasMasterKey()) {
        return res.status(500).json({ error: 'Server not configured (MASTER_KEY missing)' });
    }

    if (!checkRateLimit(req)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    const config = req.body;

    // Validate config (e.g. apiKey starts with pk_)
    if (!config.apiKey || !String(config.apiKey).startsWith('pk_')) {
        return res.status(400).json({ error: 'Invalid API Key format. Must start with pk_' });
    }

    try {
        const rawKey = await createUserBoundKey(config);
        res.status(201).json({ apiKey: rawKey });
    } catch (error) {
        logger.error({ err: error }, 'Failed to issue API key');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
