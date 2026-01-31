import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import db from '../src/db';
import { apiKeys, sessions, connections, userConfigs } from '../src/db/schema';
import { createUserBoundKey } from '../src/services/auth';
import crypto from 'crypto';

describe('Path-based API Key Authentication', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.MCP_API_KEY;
        delete process.env.MCP_API_KEYS;
        process.env.API_KEY_MODE = 'user_bound';
        process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');
        process.env.BASE_URL = 'http://localhost:3000';

        // Clear DB
        db.delete(apiKeys).run();
        db.delete(sessions).run();
        db.delete(connections).run();
        db.delete(userConfigs).run();
    });

    it('should authenticate via /key=:apiKey', async () => {
        const mockConfig = { test: 'config' };
        const rawKey = await createUserBoundKey(mockConfig);

        const res = await request(app)
            .post(`/key=${rawKey}`)
            .send({
                jsonrpc: "2.0",
                method: "notifications/initialized", // Sending a notification (no ID) or a request
                params: {},
                id: 1
            });

        // If authentication passes, it should hit the MCP handler. 
        // If method is not found, it might return error, but status should be 200 (JSON-RPC) or similar, NOT 401.
        expect(res.status).not.toBe(401);
    });

    it('should authenticate via /key=:apiKey/mcp', async () => {
        const mockConfig = { test: 'config_2' };
        const rawKey = await createUserBoundKey(mockConfig);

        const res = await request(app)
            .post(`/key=${rawKey}/mcp`)
            .send({
                jsonrpc: "2.0",
                method: "notifications/initialized",
                params: {},
                id: 1
            });

        expect(res.status).not.toBe(401);
    });

    it('should fail with invalid key in path', async () => {
        const testKey = 'mcp_sk_invalid';

        const res = await request(app)
            .post(`/key=${testKey}`)
            .send({
                jsonrpc: "2.0",
                method: "notifications/initialized",
                params: {},
                id: 1
            });

        expect(res.status).toBe(401);
    });
});
