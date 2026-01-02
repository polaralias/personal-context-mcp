import express, { Request, Response } from 'express';

const router = express.Router();

// Defined here as well or imported from a shared location.
// For now, I will duplicate or move the definition to a shared file if I was refactoring more.
// Since I already embedded it in connect.ts, I will just define it here to match.
const configSchema = {
    schema: {
        type: 'object',
        properties: {
            displayName: {
                type: 'string',
                description: 'A friendly name for this connection'
            },
            googleApiKey: {
                type: 'string',
                description: 'API Key for Google services',
                format: 'password'
            }
        },
        required: ['googleApiKey']
    }
};

router.get('/mcp-config', (_req: Request, res: Response) => {
    res.json(configSchema);
});

export default router;
