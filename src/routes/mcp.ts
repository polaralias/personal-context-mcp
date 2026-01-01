import { Router, Request, Response, NextFunction } from 'express';
import { handleMcpRequest } from '../mcp-server';
import { createLogger } from '../logger';

const router = Router();
const logger = createLogger('routes:mcp');

// Middleware to check for authentication (simplified)
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const expectedToken = process.env.MCP_BEARER_TOKEN;

    // If no token configured, allow all (or per instructions, simplify)
    if (!expectedToken) {
        return next();
    }

    let token = req.headers['authorization'];

    // Support "Bearer <token>"
    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7);
    }

    if (!token || token !== expectedToken) {
        logger.warn({ ip: req.ip }, 'Unauthorized access attempt');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};

// Mount the Streamable HTTP transport handler
// app.use('/mcp', mcpRoutes) in index.ts mounts this router at /mcp
// We capture all methods and subpaths, although SDK usually expects just the root of the mount.
router.all('/', authenticate, async (req: Request, res: Response) => {
    await handleMcpRequest(req, res);
});

// Capture subpaths if any (e.g. if SDK uses /mcp/foo)
// Note: express router mounts at /mcp, so /* here matches /mcp/*
// Using regex to avoid path-to-regexp issue with wildcard
router.all(/(.*)/, authenticate, async (req: Request, res: Response) => {
    await handleMcpRequest(req, res);
});

export default router;
