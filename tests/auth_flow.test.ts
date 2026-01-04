import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Mock dependencies
const mocks = vi.hoisted(() => {
    return {
        createConnection: vi.fn(),
        createAuthCode: vi.fn(),
        findAndValidateAuthCode: vi.fn(),
        markAuthCodeUsed: vi.fn(),
        signToken: vi.fn(),
        verifyPkce: vi.fn(),
    };
});

vi.mock('../src/services/auth', () => {
    return {
        createConnection: mocks.createConnection,
        createAuthCode: mocks.createAuthCode,
        findAndValidateAuthCode: mocks.findAndValidateAuthCode,
        markAuthCodeUsed: mocks.markAuthCodeUsed,
        signToken: mocks.signToken,
        verifyPkce: mocks.verifyPkce,
    };
});

// 5. Mock PrismaClient
vi.mock('@prisma/client', () => {
    return {
        PrismaClient: class {
            $queryRaw = vi.fn().mockResolvedValue([1]);
        },
    };
});

import app from '../src/index';

describe('Auth Flow Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset rate limits? Rate limits are in-memory in the module.
        // We might need to restart app or mock the Map if we want to test rate limits effectively
        // without time waits, but for basic functional testing we just ensure we don't hit it.
    });

    describe('GET /.well-known/mcp-config', () => {
        it('should return the standardized config schema', async () => {
            const res = await request(app).get('/.well-known/mcp-config');
            expect(res.status).toBe(200);
            expect(res.body.id).toBeDefined();
            expect(res.body.fields).toBeInstanceOf(Array);
        });
    });

    describe('GET /.well-known/oauth-protected-resource', () => {
        it('should return resource and authorization_servers', async () => {
            const res = await request(app).get('/.well-known/oauth-protected-resource');
            expect(res.status).toBe(200);
            expect(res.body.resource).toBeDefined();
            expect(res.body.authorization_servers).toBeDefined();
        });
    });

    describe('GET /connect', () => {
        it('should validate redirect_uri', async () => {
            process.env.REDIRECT_URI_ALLOWLIST = 'http://localhost:3010';

            const res = await request(app).get('/connect').query({
                redirect_uri: 'http://evil.com',
                state: '123',
                code_challenge: 'abc',
                code_challenge_method: 'S256'
            });
            expect(res.status).toBe(400);
            expect(res.text).toContain('Invalid or missing redirect_uri');
        });

        it('should allow valid redirect_uri', async () => {
            process.env.REDIRECT_URI_ALLOWLIST = 'http://localhost:3010';

            const res = await request(app).get('/connect').query({
                redirect_uri: 'http://localhost:3010',
                state: '123',
                code_challenge: 'abc',
                code_challenge_method: 'S256'
            });
            expect(res.status).toBe(200);
            expect(res.text).toContain('Connect Personal Context MCP Server');
        });
    });

    describe('POST /token', () => {
        it('should exchange code for token', async () => {
            mocks.findAndValidateAuthCode.mockResolvedValue({
                id: 'code-123',
                connectionId: 'conn-123',
                redirectUri: 'http://localhost:3010',
                codeChallenge: 'abc',
                codeChallengeMethod: 'S256'
            });
            mocks.verifyPkce.mockReturnValue(true);
            mocks.signToken.mockReturnValue('access-token-123');

            const res = await request(app).post('/token').send({
                grant_type: 'authorization_code',
                code: 'valid-code',
                code_verifier: 'verifier',
                redirect_uri: 'http://localhost:3010'
            });

            expect(res.status).toBe(200);
            expect(res.body.access_token).toBe('access-token-123');
        });

        it('should fail with invalid code', async () => {
            mocks.findAndValidateAuthCode.mockResolvedValue(null);

            const res = await request(app).post('/token').send({
                grant_type: 'authorization_code',
                code: 'invalid-code',
                code_verifier: 'verifier',
                redirect_uri: 'http://localhost:3010'
            });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_grant');
        });

        it('should enforce rate limiting', async () => {
            // We need to send > 10 requests to trigger rate limit
            // Note: Supertest requests might come from same "IP" in test env

            // First 10 should be fine (or fail due to mock logic, but not 429)
            for (let i = 0; i < 10; i++) {
                await request(app).post('/token').send({ grant_type: 'authorization_code' });
            }

            // 11th should be 429
            const res = await request(app).post('/token').send({ grant_type: 'authorization_code' });
            expect(res.status).toBe(429);
        });
    });
});
