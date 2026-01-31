import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
    findAndValidateAuthCode: vi.fn(),
    markAuthCodeUsed: vi.fn(),
    createSession: vi.fn(),
    verifyPkce: vi.fn(),
}));

vi.mock('../src/services/auth', () => mocks);



import app from '../src/index';

describe('POST /token', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 400 for unsupported grant_type', async () => {
        const res = await request(app)
            .post('/token')
            .send({ grant_type: 'client_credentials' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('unsupported_grant_type');
    });

    it('should return 400 for missing required fields', async () => {
        const res = await request(app)
            .post('/token')
            .send({ grant_type: 'authorization_code' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_request');
    });

    it('should return 400 for invalid auth code', async () => {
        mocks.findAndValidateAuthCode.mockResolvedValue(null);

        const res = await request(app)
            .post('/token')
            .send({
                grant_type: 'authorization_code',
                code: 'invalid-code',
                redirect_uri: 'http://localhost:3010/callback',
                code_verifier: 'test-verifier',
                client_id: 'test-client'
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
    });

    it('should return 400 for client_id mismatch', async () => {
        mocks.findAndValidateAuthCode.mockResolvedValue({
            code: 'hashed-code',
            clientId: 'different-client',
            redirectUri: 'http://localhost:3010/callback',
            codeChallenge: 'challenge',
            codeChallengeMethod: 'S256',
            connectionId: 'conn-123'
        });

        const res = await request(app)
            .post('/token')
            .send({
                grant_type: 'authorization_code',
                code: 'valid-code',
                redirect_uri: 'http://localhost:3010/callback',
                code_verifier: 'test-verifier',
                client_id: 'test-client'
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_client');
    });

    it('should return 400 for redirect_uri mismatch', async () => {
        mocks.findAndValidateAuthCode.mockResolvedValue({
            code: 'hashed-code',
            clientId: 'test-client',
            redirectUri: 'http://different-uri.com/callback',
            codeChallenge: 'challenge',
            codeChallengeMethod: 'S256',
            connectionId: 'conn-123'
        });

        const res = await request(app)
            .post('/token')
            .send({
                grant_type: 'authorization_code',
                code: 'valid-code',
                redirect_uri: 'http://localhost:3010/callback',
                code_verifier: 'test-verifier',
                client_id: 'test-client'
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
    });

    it('should return 400 for PKCE verification failure', async () => {
        mocks.findAndValidateAuthCode.mockResolvedValue({
            code: 'hashed-code',
            clientId: 'test-client',
            redirectUri: 'http://localhost:3010/callback',
            codeChallenge: 'challenge',
            codeChallengeMethod: 'S256',
            connectionId: 'conn-123'
        });
        mocks.verifyPkce.mockReturnValue(false);

        const res = await request(app)
            .post('/token')
            .send({
                grant_type: 'authorization_code',
                code: 'valid-code',
                redirect_uri: 'http://localhost:3010/callback',
                code_verifier: 'wrong-verifier',
                client_id: 'test-client'
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
        expect(res.body.error_description).toBe('PKCE verification failed');
    });

    it('should return access token on successful exchange', async () => {
        mocks.findAndValidateAuthCode.mockResolvedValue({
            code: 'hashed-code',
            clientId: 'test-client',
            redirectUri: 'http://localhost:3010/callback',
            codeChallenge: 'challenge',
            codeChallengeMethod: 'S256',
            connectionId: 'conn-123'
        });
        mocks.verifyPkce.mockReturnValue(true);
        mocks.markAuthCodeUsed.mockResolvedValue(undefined);
        mocks.createSession.mockResolvedValue({
            accessToken: 'session-id:secret-token',
            expiresIn: 3600
        });

        const res = await request(app)
            .post('/token')
            .send({
                grant_type: 'authorization_code',
                code: 'valid-code',
                redirect_uri: 'http://localhost:3010/callback',
                code_verifier: 'correct-verifier',
                client_id: 'test-client'
            });

        expect(res.status).toBe(200);
        expect(res.body.access_token).toBe('session-id:secret-token');
        expect(res.body.token_type).toBe('Bearer');
        expect(res.body.expires_in).toBe(3600);
        expect(mocks.markAuthCodeUsed).toHaveBeenCalledWith('hashed-code');
    });

    it('should rate limit excessive requests', async () => {
        // Make 21 requests (limit is 20)
        const requests = [];
        for (let i = 0; i < 21; i++) {
            requests.push(
                request(app)
                    .post('/token')
                    .set('X-Forwarded-For', '192.168.1.100')
                    .send({ grant_type: 'authorization_code' })
            );
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.filter(r => r.status === 429);

        expect(rateLimited.length).toBeGreaterThan(0);
    });
});
