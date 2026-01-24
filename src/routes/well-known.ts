import express, { Request, Response } from 'express';
import { getUserBoundSchema } from '../config/schema/mcp';
import { createLogger } from '../logger';

const router = express.Router();
const logger = createLogger('routes:well-known');

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
    const response: any = {
        mcp_endpoint: `${baseUrl}/mcp`,
        config_endpoint: `${baseUrl}/.well-known/mcp-config`,
        oauth_protected_resource: `${baseUrl}/.well-known/oauth-protected-resource`
    };

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

    // Support version-specific response if header present
    const protocolVersion = req.headers['mcp-protocol-version'];
    if (protocolVersion) {
        logger.debug({ protocolVersion }, 'Discovery request with specific MCP protocol version');
    }

    res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth`, // Adhere to user request for /oauth
        token_endpoint: `${baseUrl}/token`,         // Standard path
        registration_endpoint: `${baseUrl}/register`, // Standard path
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "client_credentials"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
        scopes_supported: ["mcp", "offline_access"]
    });
});

export default router;
