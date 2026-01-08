import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock overrides for environment
process.env.MASTER_KEY = 'test-master-key';
process.env.API_KEY_MODE = 'user_bound';

// Mock Prisma
vi.mock('../src/db', () => ({
    default: {
        connection: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
        $queryRaw: vi.fn().mockResolvedValue([1]),
    }
}));

// Mock logger to reduce noise
vi.mock('../src/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        child: vi.fn().mockReturnThis(),
    }),
    getRequestId: () => 'test-req-id',
}));

import app from '../src/index';

describe('UI API Standardization', () => {
    it('GET /api/master-key-status returns configured status', async () => {
        const res = await request(app).get('/api/master-key-status');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('configured');
        expect(typeof res.body.configured).toBe('boolean');
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
        expect(res.text).toContain('<title>Personal Context MCP Server</title>');
        expect(res.text).toContain('src="app.js"');
    });

    it('GET / serves Connect UI when parameters are present', async () => {
        const res = await request(app).get('/?redirect_uri=foo&state=bar&code_challenge=baz&code_challenge_method=S256');
        expect(res.status).toBe(200);
        expect(res.text).toContain('<title>Connect - Personal Context MCP Server</title>');
    });

    it('GET /api/api-keys/schema works', async () => {
        const res = await request(app).get('/api/api-keys/schema');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/verify-master-key returns 200 for correct key', async () => {
        const res = await request(app)
            .post('/api/verify-master-key')
            .send({ masterKey: 'test-master-key' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('POST /api/api-keys fails without MASTER_KEY', async () => {
        const res = await request(app)
            .post('/api/api-keys')
            .send({ config: { some: 'config' } });
        expect(res.status).toBe(401);
    });

    it('POST /api/api-keys works with MASTER_KEY', async () => {
        const res = await request(app)
            .post('/api/api-keys')
            .set('X-Master-Key', 'test-master-key')
            .send({ config: { some: 'config' } });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('apiKey');
    });
});
