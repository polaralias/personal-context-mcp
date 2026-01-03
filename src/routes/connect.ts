import express, { Request, Response } from 'express';
import { createConnection, createAuthCode } from '../services/auth';
import { createLogger } from '../logger';
import { configSchema } from './well-known';

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

// Redirect URI Validation Helper
const validateRedirectUri = (uri: string): boolean => {
    if (!uri) return false;

    // Check if absolute URL
    try {
        const parsed = new URL(uri);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }
    } catch {
        return false;
    }

    const allowListStr = process.env.REDIRECT_URI_ALLOWLIST || '';
    const allowList = allowListStr.split(',').map(u => u.trim()).filter(u => u.length > 0);
    const mode = process.env.REDIRECT_URI_ALLOWLIST_MODE || 'exact';

    if (mode === 'prefix') {
        return allowList.some(allowed => uri.startsWith(allowed));
    }

    // Default to exact
    return allowList.includes(uri);
};


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
    <title>Connect - ${configSchema.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-md w-full max-w-xl overflow-hidden">
        <div class="bg-blue-600 p-6 text-white">
            <h1 class="text-2xl font-bold">Connect ${configSchema.name}</h1>
            <p class="mt-2 opacity-90">${configSchema.description}</p>
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

                ${configSchema.fields.map(field => `
                <div>
                    <label for="${field.key}" class="block text-sm font-medium text-gray-700 mb-1">
                        ${field.label} ${field.required ? '<span class="text-red-500">*</span>' : ''}
                    </label>
                    <input
                        type="${field.secret ? 'password' : 'text'}"
                        name="${field.key}"
                        id="${field.key}"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="${field.help || ''}"
                        ${field.required ? 'required' : ''}
                        value="${!field.secret && values && values[field.key] ? values[field.key] : (field.default || '')}"
                    >
                    ${field.help ? `<p class="mt-1 text-xs text-gray-500">${field.help}</p>` : ''}
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

    if (!redirect_uri || typeof redirect_uri !== 'string' || !validateRedirectUri(redirect_uri)) {
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
    if (!checkRateLimit(req)) {
         return res.status(429).send('Too many requests');
    }

    const { redirect_uri, state, code_challenge, code_challenge_method, ...config } = req.body;

    // Re-validate params (security best practice)
    if (!redirect_uri || !validateRedirectUri(redirect_uri)) {
        return res.status(400).send('Invalid redirect_uri');
    }
    if (code_challenge_method !== 'S256') {
        return res.status(400).send('Invalid code_challenge_method');
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
