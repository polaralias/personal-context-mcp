import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';

// No mocks for DB, use real SQLite (in-memory or file)
// But we need to ensure DB is initialized.
// src/index.ts calls initDatabase() on import/start.
// In tests, we might need to clear data.

import db from '../src/db';
import { apiKeys, userConfigs } from '../src/db/schema';

describe('UI API Standardization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.MASTER_KEY = 'test-master-key';
        process.env.API_KEY_MODE = 'user_bound';

        // Clear DB
        db.delete(apiKeys).run();
        db.delete(userConfigs).run();
    });

    it('GET /api/config-status returns configured status', async () => {
        const res = await request(app).get('/api/config-status');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status');
        expect(res.body.status).toBe('present');
    });

    it('GET /api/config-schema returns fields', async () => {
        const res = await request(app).get('/api/config-schema');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('fields');
        expect(Array.isArray(res.body.fields)).toBe(true);
    });

    it('GET / serves index.html by default', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        // We can't easily check content if index.html is missing in test env or just empty.
        // But headers should be correct.
        expect(res.headers['content-type']).toContain('text/html');
    });

    it('POST /api/api-keys fails without MASTER_KEY', async () => {
        const originalKey = process.env.MASTER_KEY;
        delete process.env.MASTER_KEY; // This might not work if cached in module, but let's try.
        // Actually src/utils/masterKey.ts reads env var on call if not cached?
        // Let's check getMasterKeyBytes implementation. 
        // Re-importing might be needed if it caches.
        // Assuming it reads process.env on every call or we can mock getMasterKeyBytes.

        // Since we are running in same process, deleting env var should affect subsequent calls if not cached.

        // However, masterKey might be cached. 
        // Let's mock getMasterKeyBytes instead? No, let's keep it simple.

        // If it fails, we will know.

        // Alternatively, use a spy.

        const res = await request(app)
            .post('/api/api-keys')
            .send({ googleMapsApiKey: 'maps-key', homeLocation: 'London' });

        // If MASTER_KEY is missing, it should crash or return 500 when trying to encrypt.
        expect(res.status).toBe(500);

        process.env.MASTER_KEY = originalKey;
    });

    it('POST /api/api-keys works with MASTER_KEY', async () => {
        const res = await request(app)
            .post('/api/api-keys')
            .send({ googleMapsApiKey: 'maps-key', homeLocation: 'London' });

        expect(res.status).toBe(201); // Created
        expect(res.body).toHaveProperty('apiKey');
        expect(res.body.apiKey).toMatch(/^mcp_sk_/);
    });
});
