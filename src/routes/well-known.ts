import express, { Request, Response } from 'express';
import { getUserBoundSchema } from '../config/schema/mcp';

const router = express.Router();

const getBaseUrl = (req: Request): string => {
    if (process.env.BASE_URL) {
        let url = process.env.BASE_URL;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            console.warn(`[WARN] BASE_URL '${url}' is missing scheme. Defaulting to https://.`);
            url = `https://${url}`;
        }
        return url.replace(/\/$/, '');
    }

    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`;
};

router.get('/mcp', (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.json({
        mcp_endpoint: `${baseUrl}/mcp`,
        config_endpoint: `${baseUrl}/.well-known/mcp-config`,
        oauth_protected_resource: `${baseUrl}/.well-known/oauth-protected-resource`
    });
});

router.get('/mcp-config', (_req, res) => {
    res.json(getUserBoundSchema());
});

router.get('/oauth-protected-resource', (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.json({
        resource: `${baseUrl}/mcp`,
        authorization_servers: [baseUrl]
    });
});

router.get('/oauth-authorization-server', (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/connect`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"]
    });
});

export default router;
