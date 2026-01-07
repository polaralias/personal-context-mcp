import express, { Request, Response } from 'express';
import { createConnection, createAuthCode, getRegisteredClient } from '../services/auth';
import { createLogger } from '../logger';
import { configSchema } from './well-known';
import { hasMasterKey } from '../utils/masterKey';

const router = express.Router();
const logger = createLogger('routes:connect');

// In-memory rate limiting for /connect
const connectRateLimit = new Map<string, { count: number; timestamp: number }>();
const CONNECT_WINDOW_MS = 60 * 1000; // 1 minute
const CONNECT_MAX_REQUESTS = 20;

const checkRateLimit = (req: Request): boolean => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const limit = connectRateLimit.get(ip);

    if (!limit) {
        connectRateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (now - limit.timestamp > CONNECT_WINDOW_MS) {
        // Reset window
        connectRateLimit.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (limit.count >= CONNECT_MAX_REQUESTS) {
        return false;
    }

    limit.count++;
    return true;
};




export const renderHtml = (error?: string, values?: any, query?: any) => {
    const safeQuery = query || {};
    const redirectUri = safeQuery.redirect_uri || '';
    const clientId = safeQuery.client_id || '';
    const state = safeQuery.state || '';
    const codeChallenge = safeQuery.code_challenge || '';
    const codeChallengeMethod = safeQuery.code_challenge_method || '';

    // Requirement: Clear on-page error if required params are missing
    const missingParams: string[] = [];
    if (!clientId) missingParams.push('client_id');
    if (!redirectUri) missingParams.push('redirect_uri');
    if (!codeChallenge) missingParams.push('code_challenge');
    if (codeChallengeMethod !== 'S256') missingParams.push('code_challenge_method (must be S256)');

    let fatalError = error;
    if (missingParams.length > 0) {
        fatalError = `Missing or invalid required parameters: ${missingParams.join(', ')}`;
    }

    return `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connect Personal Context MCP</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>

<body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-lg max-w-lg w-full p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-2 text-center">Personal Context MCP Server</h1>
        <p class="text-gray-600 text-center mb-6">Configure your connection</p>

        ${fatalError ? `<div class="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded" role="alert">
            <p class="font-bold">Error</p>
            <p>${fatalError}</p>
        </div>` : ''}

        <form action="/connect" method="POST" class="space-y-4">
            <input type="hidden" name="redirect_uri" value="${redirectUri}">
            <input type="hidden" name="client_id" value="${clientId}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${codeChallenge}">
            <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}">

            <fieldset class="${missingParams.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${missingParams.length > 0 ? 'disabled' : ''}>
                ${configSchema.fields.map(field => `
                <div class="mb-4">
                    <label for="${field.key}" class="block text-sm font-medium text-gray-700 mb-1">
                        ${field.label} ${field.required ? '<span class="text-red-500">*</span>' : ''}
                    </label>
                    <input
                        type="${field.secret ? 'password' : 'text'}"
                        name="${field.key}"
                        id="${field.key}"
                        class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="${field.help || ''}"
                        ${field.required ? 'required' : ''}
                        value="${!field.secret && values && values[field.key] ? values[field.key] : (field.default || '')}"
                    >
                    ${field.help ? `<p class="text-xs text-gray-500 mt-1">${field.help}</p>` : ''}
                </div>
                `).join('')}

                <div class="pt-4">
                    <button type="submit" 
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition ${missingParams.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                        ${missingParams.length > 0 ? 'disabled' : ''}>
                        Connect
                    </button>
                </div>
            </fieldset>
        </form>
    </div>
</body>
</html>
    `;
};

router.get('/', async (req: Request, res: Response) => {
    // Requirements: GET /connect must require client_id
    // Connect UI must propagate client_id, redirect_uri, code_challenge, code_challenge_method
    // Show clear on-page error if params missing (handled by renderHtml internally)

    const { client_id, redirect_uri } = req.query;

    if (client_id && typeof client_id === 'string') {
        const registeredClient = await getRegisteredClient(client_id);
        if (!registeredClient) {
            return res.status(400).send(renderHtml('Invalid client_id', undefined, req.query));
        }

        if (redirect_uri && typeof redirect_uri === 'string' && !registeredClient.redirectUris.includes(redirect_uri)) {
            logger.warn({
                event: 'redirect_uri_rejected',
                rejected_uri: redirect_uri,
                allowed_uris: registeredClient.redirectUris,
                client_id,
                path: '/connect',
                ip: req.ip
            }, 'Redirect URI rejected: not registered for this client');
            return res.status(400).send(renderHtml("This client isn't in the redirect allow list - raise an issue on GitHub for it to be added", undefined, req.query));
        }
    }

    res.send(renderHtml(undefined, undefined, req.query));
});

router.post('/', async (req: Request, res: Response) => {
    if (!hasMasterKey()) {
        return res.status(400).send(renderHtml('Connection creation blocked: MASTER_KEY is missing.', undefined, req.body));
    }
    if (!checkRateLimit(req)) {
        return res.status(429).send(renderHtml('Too many requests', undefined, req.body));
    }

    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, ...config } = req.body;

    // Re-validate params (security best practice)
    if (!client_id) {
        return res.status(400).send(renderHtml('Missing client_id', undefined, req.body));
    }
    const registeredClient = await getRegisteredClient(client_id);
    if (!registeredClient) {
        return res.status(400).send(renderHtml('Invalid client_id', undefined, req.body));
    }

    if (!redirect_uri || !registeredClient.redirectUris.includes(redirect_uri)) {
        logger.warn({
            event: 'redirect_uri_rejected',
            rejected_uri: redirect_uri,
            allowed_uris: registeredClient.redirectUris,
            client_id,
            path: '/connect',
            ip: req.ip
        }, 'Redirect URI rejected: not registered for this client');
        return res.status(400).send(renderHtml("This client isn't in the redirect allow list - raise an issue on GitHub for it to be added", undefined, req.body));
    }
    if (code_challenge_method !== 'S256') {
        return res.status(400).send(renderHtml('Invalid code_challenge_method', undefined, req.body));
    }

    try {
        // Extract known config fields
        const finalConfig: any = {};
        // We use the first non-secret field as displayName or default to "Connection"
        let displayName = "Connection";
        const nameField = configSchema.fields.find(f => f.key === 'displayName');
        if (nameField && config[nameField.key]) {
            displayName = config[nameField.key];
        }

        for (const field of configSchema.fields) {
            if (field.required && !config[field.key]) {
                return res.send(renderHtml(`Field ${field.label} is required`, config, req.body));
            }
            finalConfig[field.key] = config[field.key];
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
