import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createConnection, createAuthCode, getClient } from '../services/auth';
import { createLogger } from '../logger';
import { hasMasterKey } from '../utils/masterKey';
import { validateConnectConfig } from '../config/schema/mcp';

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

// GET /connect
router.get('/', async (req: Request, res: Response) => {
    const { client_id, redirect_uri, code_challenge, code_challenge_method } = req.query;

    if (!client_id || typeof client_id !== 'string') {
        return res.status(400).send('Missing client_id');
    }

    if (!redirect_uri || typeof redirect_uri !== 'string') {
        return res.status(400).send('Missing redirect_uri');
    }

    if (!code_challenge || typeof code_challenge !== 'string') {
        return res.status(400).send('Missing code_challenge');
    }

    if (!code_challenge_method || typeof code_challenge_method !== 'string') {
        return res.status(400).send('Missing code_challenge_method');
    }

    const client = await getClient(client_id);
    if (!client) {
        return res.status(400).send('Invalid client_id');
    }

    const allowedUris = client.redirectUris as string[];
    if (!allowedUris.includes(redirect_uri)) {
        logger.warn({
            event: 'redirect_uri_rejected',
            rejected_uri: redirect_uri,
            allowed_uris: allowedUris,
            client_id,
            path: '/connect',
            ip: req.ip
        }, 'Redirect URI rejected: not registered for this client');
        return res.status(400).send('Redirect URI not allowed');
    }

    if (code_challenge_method !== 'S256') {
        return res.status(400).send('Invalid code_challenge_method (must be S256)');
    }

    // Generate CSRF Token
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf_token', csrfToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: req.secure || req.get('x-forwarded-proto') === 'https'
    });

    // Read HTML and inject CSRF
    const htmlPath = path.join(__dirname, '../public/connect.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('{{CSRF_TOKEN}}', csrfToken);

    res.send(html);
});

// POST /connect
router.post('/', async (req: Request, res: Response) => {
    if (!hasMasterKey()) {
        return res.status(500).json({ error: 'Server not configured (MASTER_KEY missing)' });
    }

    if (!checkRateLimit(req)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    // CSRF Check
    const cookieToken = req.cookies?.csrf_token || (req.headers.cookie && req.headers.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1]);
    const bodyToken = req.body.csrf_token;

    if (!cookieToken || !bodyToken || cookieToken !== bodyToken) {
        return res.status(403).json({ error: 'CSRF token mismatch' });
    }

    const {
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        name,
        config
    } = req.body;

    if (!client_id || !redirect_uri || !code_challenge || !code_challenge_method || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await getClient(client_id);
    if (!client) {
        return res.status(400).json({ error: 'Invalid client_id' });
    }

    const allowedUris = client.redirectUris as string[];
    if (!allowedUris.includes(redirect_uri)) {
        return res.status(400).json({ error: 'Redirect URI not allowed' });
    }

    if (code_challenge_method !== 'S256') {
        return res.status(400).json({ error: 'Invalid code_challenge_method' });
    }

    const parsed = validateConnectConfig(config);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid configuration payload' });
    }

    // Split config into public and private
    const { googleMapsApiKey, haToken, ...publicConfig } = parsed.data;
    const secretConfig: Record<string, string> = { apiKey: googleMapsApiKey };
    if (haToken) {
        secretConfig.haToken = haToken;
    }

    try {
        const connection = await createConnection(name, publicConfig, secretConfig);
        const code = await createAuthCode(
            connection.id,
            redirect_uri,
            state,
            code_challenge,
            code_challenge_method,
            client_id
        );

        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.append('code', code);
        if (state) redirectUrl.searchParams.append('state', state);

        res.json({ redirectUrl: redirectUrl.toString() });

    } catch (error: any) {
        logger.error({ err: error }, 'Failed to create connection');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
