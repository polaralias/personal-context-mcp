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
        createSession: vi.fn(),
        getClient: vi.fn(),
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
        createSession: mocks.createSession,
        getClient: mocks.getClient,
    };
});



import app from '../src/index';

describe('Auth Flow Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset rate limits? Rate limits are in-memory in the module.
        // We might need to restart app or mock the Map if we want to test rate limits effectively
        // without time waits, but for basic functional testing we just ensure we don't hit it.
        mocks.getClient.mockResolvedValue({
            redirectUris: ['http://localhost:3010']
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
                code_challenge_method: 'S256',
                client_id: 'client-123'
            });
            expect(res.status).toBe(400);
            expect(res.text).toContain('isn\'t on the allowlist');
            expect(res.text).toContain('http://evil.com');
            expect(res.text).toContain('https://github.com/polaralias/personal-context-mcp');
        });

        it('should allow valid redirect_uri', async () => {
            process.env.REDIRECT_URI_ALLOWLIST = 'http://localhost:3010';

            const res = await request(app).get('/connect').query({
                redirect_uri: 'http://localhost:3010',
                state: '123',
                code_challenge: 'abc',
                code_challenge_method: 'S256',
                client_id: 'client-123'
            });
            expect(res.status).toBe(200);
            expect(res.text).toContain('Authorize');
        });
    });

    describe('POST /token', () => {
        it('should exchange code for token', async () => {
            mocks.findAndValidateAuthCode.mockResolvedValue({
                id: 'code-123',
                connectionId: 'conn-123',
                redirectUri: 'http://localhost:3010',
                codeChallenge: 'abc',
                codeChallengeMethod: 'S256',
                clientId: 'client-123'
            });
            mocks.verifyPkce.mockReturnValue(true);
            mocks.signToken.mockReturnValue('access-token-123');
            mocks.createSession.mockResolvedValue({
                accessToken: 'access-token-123',
                expiresIn: 3600
            });

            const res = await request(app).post('/token').send({
                grant_type: 'authorization_code',
                code: 'valid-code',
                code_verifier: 'verifier',
                redirect_uri: 'http://localhost:3010',
                client_id: 'client-123'
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
                redirect_uri: 'http://localhost:3010',
                client_id: 'client-123'
            });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_grant');
        });

        it('should enforce rate limiting', async () => {
            // We need to send > 10 requests to trigger rate limit
            // Note: Supertest requests might come from same "IP" in test env

            // First 20 should be fine (limit is 20)
            for (let i = 0; i < 20; i++) {
                await request(app).post('/token').send({ grant_type: 'authorization_code' });
            }

            // 11th should be 429
            const res = await request(app).post('/token').send({ grant_type: 'authorization_code' });
            expect(res.status).toBe(429);
        });
    });
});
