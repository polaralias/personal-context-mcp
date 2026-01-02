import express, { Request, Response } from 'express';
import { createConnection, createAuthCode } from '../services/auth';
import { createLogger } from '../logger';

const router = express.Router();
const logger = createLogger('routes:connect');

// Config Schema for the UI
// In a real scenario, this might come from a service or file
const configSchema = [
    { name: 'displayName', label: 'Display Name', type: 'text', required: false, description: 'A friendly name for this connection' },
    { name: 'googleApiKey', label: 'Google API Key', type: 'password', required: true, description: 'API Key for Google services' }
    // Add other config fields here as needed
];

const renderHtml = (error?: string, values?: any, query?: any) => {
    const safeQuery = query || {};
    // Ensure we preserve the query params for the form action or hidden fields
    const redirectUri = safeQuery.redirect_uri || '';
    const state = safeQuery.state || '';
    const codeChallenge = safeQuery.code_challenge || '';
    const codeChallengeMethod = safeQuery.code_challenge_method || '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connect - Personal Context MCP</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-md w-full max-w-xl overflow-hidden">
        <div class="bg-blue-600 p-6 text-white">
            <h1 class="text-2xl font-bold">Connect Personal Context MCP</h1>
            <p class="mt-2 opacity-90">Configure your connection settings.</p>
        </div>

        <div class="p-6">
            ${error ? `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
                <p>${error}</p>
            </div>` : ''}

            <form action="/connect" method="POST" class="space-y-4">
                <input type="hidden" name="redirect_uri" value="${redirectUri}">
                <input type="hidden" name="state" value="${state}">
                <input type="hidden" name="code_challenge" value="${codeChallenge}">
                <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}">

                ${configSchema.map(field => `
                <div>
                    <label for="${field.name}" class="block text-sm font-medium text-gray-700 mb-1">
                        ${field.label} ${field.required ? '<span class="text-red-500">*</span>' : ''}
                    </label>
                    <input
                        type="${field.type}"
                        name="${field.name}"
                        id="${field.name}"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="${field.description || ''}"
                        ${field.required ? 'required' : ''}
                        value="${field.type !== 'password' && values && values[field.name] ? values[field.name] : ''}"
                    >
                    ${field.description ? `<p class="mt-1 text-xs text-gray-500">${field.description}</p>` : ''}
                </div>
                `).join('')}

                <div class="pt-4">
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out">
                        Connect
                    </button>
                </div>
            </form>
        </div>
    </div>
</body>
</html>
    `;
};

router.get('/', (req: Request, res: Response) => {
    const { redirect_uri, state, code_challenge, code_challenge_method } = req.query;

    const allowList = (process.env.REDIRECT_URI_ALLOWLIST || '').split(',').map(u => u.trim());

    if (!redirect_uri || typeof redirect_uri !== 'string' || !allowList.includes(redirect_uri)) {
        return res.status(400).send('Invalid or missing redirect_uri');
    }

    if (!state || typeof state !== 'string') {
        return res.status(400).send('Missing state');
    }

    if (!code_challenge || typeof code_challenge !== 'string') {
        return res.status(400).send('Missing code_challenge');
    }

    if (code_challenge_method !== 'S256') {
        return res.status(400).send('Invalid code_challenge_method. Must be S256');
    }

    res.send(renderHtml(undefined, undefined, req.query));
});

router.post('/', async (req: Request, res: Response) => {
    const { redirect_uri, state, code_challenge, code_challenge_method, ...config } = req.body;

    // Re-validate params (security best practice)
    const allowList = (process.env.REDIRECT_URI_ALLOWLIST || '').split(',').map(u => u.trim());
    if (!redirect_uri || !allowList.includes(redirect_uri)) {
        return res.status(400).send('Invalid redirect_uri');
    }
    if (code_challenge_method !== 'S256') {
        return res.status(400).send('Invalid code_challenge_method');
    }

    try {
        // Extract known config fields
        const finalConfig: any = {};
        let displayName = null;

        for (const field of configSchema) {
            if (field.required && !config[field.name]) {
                return res.send(renderHtml(`Field ${field.label} is required`, config, req.body));
            }
            finalConfig[field.name] = config[field.name];
            if (field.name === 'displayName') displayName = config[field.name];
        }

        const connection = await createConnection(displayName, finalConfig);
        const code = await createAuthCode(
            connection.id,
            redirect_uri,
            state,
            code_challenge,
            code_challenge_method
        );

        // Redirect
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.append('code', code);
        redirectUrl.searchParams.append('state', state);

        res.redirect(redirectUrl.toString());

    } catch (error) {
        logger.error({ err: error }, 'Error creating connection');
        res.status(500).send('Internal Server Error');
    }
});

export default router;
