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

router.get(['/mcp', '/mcp-configuration'], (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    // Determine if this is coming from the /oauth mount point
    const isOAuthDiscovery = req.baseUrl.startsWith('/oauth');

    const response: any = {
        mcp_endpoint: `${baseUrl}/mcp`
    };

    if (isOAuthDiscovery) {
        response.oauth_protected_resource = `${baseUrl}/oauth/.well-known/oauth-protected-resource`;
    } else {
        // Root baseURL discovery returns the config_endpoint for API keys
        response.config_endpoint = `${baseUrl}/.well-known/mcp-config`;
    }

    res.json(response);
});

router.get(['/mcp-config', '/mcp-configuration-schema'], (_req, res) => {
    res.json(getUserBoundSchema());
});

router.get('/oauth-protected-resource', (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.json({
        resource: `${baseUrl}/mcp`,
        authorization_servers: [baseUrl + '/oauth']
    });
});

router.get('/oauth-authorization-server', (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/oauth/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"]
    });
});

export default router;
