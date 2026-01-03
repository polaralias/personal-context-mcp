import express, { Request, Response } from 'express';
// @ts-ignore
import packageJson from '../../package.json';

const router = express.Router();

export const configSchema = {
    id: "personal-context-mcp",
    name: "Personal Context MCP",
    description: "Aggregates user status signals like location and calendar events.",
    version: packageJson.version || "1.0.0",
    fields: [
        {
            key: "displayName",
            label: "Display Name",
            type: "string",
            required: false,
            secret: false,
            default: "",
            help: "A friendly name for this connection"
        },
        {
            key: "googleApiKey",
            label: "Google API Key",
            type: "string",
            required: true,
            secret: true,
            default: "",
            help: "API Key for Google services"
        }
    ]
};

const getBaseUrl = (req: Request): string => {
    if (process.env.BASE_URL) {
        return process.env.BASE_URL;
    }

    // Express 'trust proxy' is enabled in index.ts, so req.protocol and req.get('host')
    // will correctly reflect X-Forwarded-* headers if present and trusted.
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`;
};

router.get('/oauth-protected-resource', (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.json({
        resource: baseUrl,
        authorization_servers: [baseUrl]
    });
});

router.get('/oauth-authorization-server', (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/connect`,
        token_endpoint: `${baseUrl}/token`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"]
    });
});

router.get('/mcp-config', (_req: Request, res: Response) => {
    res.json(configSchema);
});

export default router;
