import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import db from '../src/db';
import { apiKeys, sessions, connections, userConfigs } from '../src/db/schema';
import { createConnection, createSession, createUserBoundKey } from '../src/services/auth';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('MCP Dual Auth Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.MCP_API_KEY;
        delete process.env.MCP_API_KEYS;
        process.env.BASE_URL = 'http://localhost:3000';
        // Set a valid Master Key for encryption/decryption in tests
        process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');

        // Clear DB
        db.delete(apiKeys).run();
        db.delete(sessions).run();
        db.delete(connections).run();
        db.delete(userConfigs).run();
    });

    describe('POST /mcp', () => {
        it('should return 401 when no auth is provided', async () => {
            const res = await request(app)
                .post('/mcp')
                .set('Accept', 'application/json, text/event-stream')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(401);
            expect(res.body.error.message).toContain('Authentication required');
        });

        it('should return 200 with valid Bearer token', async () => {
            // Setup
            const connection = await createConnection('test-conn', {}, { apiKey: 'secret' });
            const session = await createSession(connection.id);
            // session.accessToken is "sessionId:secret"

            const res = await request(app)
                .post('/mcp')
                .set('Accept', 'application/json, text/event-stream')
                .set('Authorization', `Bearer ${session.accessToken}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);
        });

        it('should return 401 with invalid Bearer token', async () => {
            const res = await request(app)
                .post('/mcp')
                .set('Accept', 'application/json, text/event-stream')
                .set('Authorization', 'Bearer invalid-token')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(401);
            expect(res.body.error.message).toContain('Invalid API key'); // Or "Invalid token" depending on impl
        });

        it('should return 200 with valid API key in header', async () => {
            process.env.MCP_API_KEY = 'test-api-key';

            const res = await request(app)
                .post('/mcp')
                .set('Accept', 'application/json, text/event-stream')
                .set('x-api-key', 'test-api-key')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);
        });

        it('should return 200 with valid API key in query param', async () => {
            process.env.MCP_API_KEY = 'test-api-key';

            const res = await request(app)
                .post('/mcp')
                .set('Accept', 'application/json, text/event-stream')
                .query({ apiKey: 'test-api-key' })
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);
        });

        it('should return 200 with one of the keys from MCP_API_KEYS', async () => {
            process.env.MCP_API_KEYS = 'key1, key2, key3';

            const res = await request(app)
                .post('/mcp')
                .set('Accept', 'application/json, text/event-stream')
                .set('x-api-key', 'key2')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);
        });

        it('should return 200 with valid user-bound API key', async () => {
            // Create user bound key
            const mockConfig = { googleMapsApiKey: 'secret' };
            const rawKey = await createUserBoundKey(mockConfig);

            const res = await request(app)
                .post('/mcp')
                .set('Accept', 'application/json, text/event-stream')
                .set('x-api-key', rawKey)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);

            // Verify lastUsedAt is updated (might need a small delay or check async nature)
            // Implementation does Promise.resolve().then(...) so it might not be immediate in test
        });

        it('should return 401 with invalid API key', async () => {
            process.env.MCP_API_KEY = 'test-api-key';

            const res = await request(app)
                .post('/mcp')
                .set('Accept', 'application/json, text/event-stream')
                .set('x-api-key', 'wrong-key')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(401);
        });

        it('should prioritize Bearer token over API key if both provided', async () => {
            // Bearer is checked first. If present but invalid, it falls through to API Key?
            // src/middleware/mcpAuth.ts: 
            // 1. Check User Bound (mcp_sk_)
            // 2. Check Session (Bearer/Connection)
            // 3. Check Global Env Key

            // If I send Bearer 'invalid-token' and x-api-key 'valid-key'
            // If invalid-token is NOT mcp_sk_, it goes to step 2.
            // verifyAccessToken returns null.
            // It goes to step 3. 
            // It sees valid api key.
            // So it SHOULD return 200 if logic falls through.

            // BUT wait, logic says:
            // if (connectionId) { ... return next() }

            // If verifyAccessToken returns null, it proceeds to Step 3.

            process.env.MCP_API_KEY = 'test-api-key';

            const res = await request(app)
                .post('/mcp')
                .set('Accept', 'application/json, text/event-stream')
                .set('Authorization', 'Bearer invalid-token')
                .set('x-api-key', 'test-api-key')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            // Based on logic in mcpAuth.ts:
            // candidateKey will be 'invalid-token' (from Authorization header).
            // It is NOT mcp_sk_.
            // verifyAccessToken('invalid-token') -> null.
            // validateApiKey('invalid-token') -> false (unless 'invalid-token' == 'test-api-key').

            // So it fails. The middleware extracts ONE candidate key. 
            // Line 60: if (authHeader) candidateKey = ...
            // Line 69: if (!candidateKey) candidateKey = apiKeyHeader...

            // So if Auth Header is present, that IS the candidate key. It IGNORES x-api-key.

            expect(res.status).toBe(401);
        });
    });
});
