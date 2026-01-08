import express from 'express';
import { ApiKeyService } from '../services/apiKeyService';
import { issueRateLimiter } from '../utils/rateLimit';
import { createLogger } from '../logger';
import { configFields } from '../config/schema/personal-context';

const router = express.Router();
const logger = createLogger('routes:api-keys');
const apiKeyService = ApiKeyService.getInstance();

// Middleware to check API_KEY_MODE
const checkMode = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (process.env.API_KEY_MODE !== 'user_bound') {
        return res.status(404).json({ error: 'User-bound API keys are disabled' });
    }
    next();
};

/**
 * Middleware to check if the request is authorized via MASTER_KEY.
 * Simple implementation: check X-Master-Key header.
 */
const authenticateMasterKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const providedKey = req.headers['x-master-key'] as string;
    const actualKey = process.env.MASTER_KEY;

    if (!actualKey) {
        return res.status(500).json({ error: 'Server MASTER_KEY not configured' });
    }

    if (providedKey !== actualKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Master Key' });
    }
    next();
};

router.use(checkMode);

// GET /schema - Helper for UI to render form
router.get('/schema', (_req, res) => {
    res.json(configFields);
});

// POST / - Issue new key (Requires Master Key)
router.post('/', authenticateMasterKey, async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // 1. Rate Limit
    if (!issueRateLimiter.check(ip)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }

    // 2. Validate Turnstile (Placeholder if needed)
    if (process.env.TURNSTILE_SITE_KEY) {
        const token = req.body['cf-turnstile-response'];
        if (!token) {
            // Return 400 but allow testing bypass
            if (process.env.TEST_BYPASS_TURNSTILE !== 'true') {
                return res.status(400).json({ error: 'Turnstile verification failed' });
            }
        }
        // TODO: Verify with Cloudflare API
    }

    try {
        const body = req.body ?? {};
        const config = (body && typeof body === 'object' && 'config' in body) ? (body as any).config : body;

        if (!config || (typeof config === 'object' && Object.keys(config).length === 0)) {
            return res.status(400).json({ error: 'Missing configuration' });
        }

        const result = await apiKeyService.provisionKey(config, ip);

        // Return the key ONLY ONCE
        res.json({ apiKey: result.key });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to issue API key');
        res.status(400).json({ error: error.message });
    }
});

// Removed /me and /revoke endpoints to minimize exposure and avoid listability.
// API Keys represent connections that should be ephemeral in management.

export default router;
