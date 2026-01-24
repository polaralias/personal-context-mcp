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
        userConfig: {
            create: vi.fn().mockResolvedValue({ id: 'uc-123' }),
        },
        apiKey: {
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
    it('GET /api/config-status returns configured status', async () => {
        const res = await request(app).get('/api/config-status');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status');
        expect(res.body.status).toBe('present'); // Mock sets MASTER_KEY
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
        expect(res.text).toContain('<title>MCP | Personalized Context</title>');
        expect(res.text).toContain('src="app.js"');
    });







    it('POST /api/api-keys fails without MASTER_KEY', async () => {
        // Unset master key for this test
        const originalKey = process.env.MASTER_KEY;
        delete process.env.MASTER_KEY;
        const res = await request(app)
            .post('/api/api-keys')
            .send({ googleMapsApiKey: 'maps-key', homeLocation: 'London' });
        expect(res.status).toBe(500);
        process.env.MASTER_KEY = originalKey;
    });

    it('POST /api/api-keys works with MASTER_KEY', async () => {
        const res = await request(app)
            .post('/api/api-keys')
            .send({ googleMapsApiKey: 'maps-key', homeLocation: 'London' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('apiKey');
    });
});
