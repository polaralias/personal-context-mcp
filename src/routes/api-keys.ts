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

router.use(checkMode);

// GET /schema - Helper for UI to render form
router.get('/schema', (_req, res) => {
    res.json(configFields);
});

// POST / - Issue new key
router.post('/', async (req, res) => {
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

        res.json({ apiKey: result.key });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to issue API key');
        res.status(400).json({ error: error.message });
    }
});

// GET /me - Metadata (Authenticated)
router.get('/me', async (req, res) => {
    // This route requires auth. 
    // We can rely on mcpAuth middleware if attached, but mcpAuth is specific to /mcp usually.
    // We need to validate the key here specifically for this management route.

    const token = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-api-key'] as string;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    // We don't use mcpAuth here because we want the metadata, which authenticateMcp puts in req.mcpConfig?
    // authenticateMcp puts config in req.mcpConfig, but doesn't expose metadata like created date.
    // So we resolve it ourselves.

    const result = await apiKeyService.validateKey(token, req.ip || 'unknown');
    if (!result) return res.status(401).json({ error: 'Unauthorized' });

    res.json(result.metadata);
});

// POST /revoke - Revoke key
router.post('/revoke', async (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-api-key'] as string;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const result = await apiKeyService.validateKey(token, req.ip || 'unknown');
    if (!result) return res.status(401).json({ error: 'Unauthorized' });

    await apiKeyService.revokeKey(token);
    res.json({ success: true });
});

export default router;
