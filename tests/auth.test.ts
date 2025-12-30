import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Use vi.hoisted to create vars that are available inside vi.mock
const { mockFindUnique, mockCreate, mockDelete, mockFindFirst } = vi.hoisted(() => {
    return {
        mockFindUnique: vi.fn(),
        mockCreate: vi.fn(),
        mockDelete: vi.fn(),
        mockFindFirst: vi.fn()
    };
});

// Must mock BEFORE importing app
vi.mock('@prisma/client', () => {
    class MockPrismaClient {
        authCode = {
            create: mockCreate,
            findUnique: mockFindUnique,
            delete: mockDelete
        };
        clientSession = {
            create: mockCreate,
            findUnique: mockFindUnique
        };
        workStatusEvent = { findFirst: mockFindFirst };
        locationEvent = { findFirst: mockFindFirst };
        scheduledStatus = { findUnique: mockFindUnique };

        constructor(options?: any) {
            // ignore
        }
    }
    return { PrismaClient: MockPrismaClient };
});

import app from '../src/index';

describe('Auth Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindUnique.mockReset();
        mockCreate.mockReset();
        mockDelete.mockReset();
        mockFindFirst.mockReset();
    });

    it('GET / should serve the config page', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.header['content-type']).toContain('text/html');
    });

    it('POST /api/auth/authorize should create code and redirect', async () => {
        const callbackUrl = 'https://app.com/cb';
        const state = 'xyz';

        mockCreate.mockResolvedValueOnce({ token: 'sess_123' }); // ClientSession
        mockCreate.mockResolvedValueOnce({ code: 'code_123' }); // AuthCode

        const res = await request(app)
            .post('/api/auth/authorize')
            .send({ callbackUrl, state, connectionUrl: 'http://me' });

        expect(res.status).toBe(200);
        expect(res.body.redirectUrl).toContain(callbackUrl);
        expect(res.body.redirectUrl).toContain('code=');
    });

    it('POST /api/auth/authorize should fail without callbackUrl', async () => {
        const res = await request(app)
            .post('/api/auth/authorize')
            .send({ state: 'xyz' });

        expect(res.status).toBe(400);
    });

    it('POST /api/auth/token should exchange code for token', async () => {
        const code = 'code_123';
        const sessionToken = 'sess_123';

        mockFindUnique.mockResolvedValue({
            code,
            expiresAt: new Date(Date.now() + 60000),
            sessionToken
        });
        mockDelete.mockResolvedValue({});

        const res = await request(app)
            .post('/api/auth/token')
            .send({ code });

        if (res.status !== 200) {
            console.log('Error body:', res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body.access_token).toBe(sessionToken);
    });

    it('GET /mcp/sse should reject without token', async () => {
        const res = await request(app).get('/mcp/sse');
        expect(res.status).toBe(401);
    });
});
