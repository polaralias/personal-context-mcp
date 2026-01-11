import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock dependencies
const mocks = vi.hoisted(() => {
    return {
        verifyToken: vi.fn(),
        getConnection: vi.fn(),
        decryptConfig: vi.fn(),
        prisma: {
            apiKey: { findUnique: vi.fn(), update: vi.fn() },
            session: { findUnique: vi.fn() },
            connection: { findUnique: vi.fn() },
        }
    };
});

vi.mock('../src/services/auth', async () => {
    const actual = await vi.importActual('../src/services/auth');
    return {
        ...actual,
        verifyToken: mocks.verifyToken,
        getConnection: mocks.getConnection,
        decryptConfig: mocks.decryptConfig,
    };
});

vi.mock('../src/db', () => {
    return {
        default: mocks.prisma,
        __esModule: true,
    };
});

import app from '../src/index';

describe('MCP Dual Auth Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.MCP_API_KEY;
        delete process.env.MCP_API_KEYS;
        process.env.BASE_URL = 'http://localhost:3000';
    });

    describe('POST /mcp', () => {
        it('should return 401 when no auth is provided', async () => {
            const res = await request(app)
                .post('/mcp')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(401);
            expect(res.body.error).toContain('Authentication required');
        });

        it('should return 200 with valid Bearer token', async () => {
            mocks.verifyToken.mockReturnValue('conn-123');
            mocks.getConnection.mockResolvedValue({ id: 'conn-123', configEncrypted: 'iv:tag:data' });
            mocks.decryptConfig.mockReturnValue({ apiKey: 'secret' });

            const res = await request(app)
                .post('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);
        });

        it('should return 401 with invalid Bearer token', async () => {
            mocks.verifyToken.mockReturnValue(null);

            const res = await request(app)
                .post('/mcp')
                .set('Authorization', 'Bearer invalid-token')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(401);
            expect(res.body.error).toContain('Invalid token');
        });

        it('should return 200 with valid API key in header', async () => {
            process.env.MCP_API_KEY = 'test-api-key';

            const res = await request(app)
                .post('/mcp')
                .set('x-api-key', 'test-api-key')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);
        });

        it('should return 200 with valid API key in query param', async () => {
            process.env.MCP_API_KEY = 'test-api-key';

            const res = await request(app)
                .post('/mcp')
                .query({ apiKey: 'test-api-key' })
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);
        });

        it('should return 200 with one of the keys from MCP_API_KEYS', async () => {
            process.env.MCP_API_KEYS = 'key1, key2, key3';

            const res = await request(app)
                .post('/mcp')
                .set('x-api-key', 'key2')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);
        });

        it('should return 200 with valid user-bound API key', async () => {
            const mockKey = 'mcp_sk_valid_key';
            const mockConfig = { googleMapsApiKey: 'secret' };

            mocks.prisma.apiKey.findUnique.mockResolvedValue({
                id: 'key-123',
                revokedAt: null,
                userConfig: {
                    configEnc: 'iv:tag:enc'
                }
            });
            mocks.prisma.apiKey.update.mockResolvedValue({});
            mocks.decryptConfig.mockReturnValue(mockConfig);

            const res = await request(app)
                .post('/mcp')
                .set('x-api-key', mockKey)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(200);
            expect(mocks.prisma.apiKey.findUnique).toHaveBeenCalled();
            expect(mocks.decryptConfig).toHaveBeenCalledWith('iv:tag:enc');
        });

        it('should return 401 with invalid API key', async () => {
            process.env.MCP_API_KEY = 'test-api-key';

            const res = await request(app)
                .post('/mcp')
                .set('x-api-key', 'wrong-key')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(res.status).toBe(401);
            expect(res.body.error).toContain('Invalid API key');
        });

        it('should prioritize Bearer token over API key if both provided', async () => {
            process.env.MCP_API_KEY = 'test-api-key';
            mocks.verifyToken.mockReturnValue(null); // Invalid bearer

            const res = await request(app)
                .post('/mcp')
                .set('Authorization', 'Bearer invalid-token')
                .set('x-api-key', 'test-api-key')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            // Since Bearer is present but invalid, it should fail before checking API key
            expect(res.status).toBe(401);
            expect(res.body.error).toContain('Invalid token');
        });

        describe('OAuth Discovery Header', () => {
            it('should include WWW-Authenticate header on 401 when no auth provided', async () => {
                const res = await request(app)
                    .post('/mcp')
                    .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

                expect(res.status).toBe(401);
                expect(res.headers['www-authenticate']).toContain('Bearer resource_metadata=');
                expect(res.headers['www-authenticate']).toContain('/.well-known/oauth-protected-resource');
            });

            it('should respect X-Forwarded-Proto for discovery URL', async () => {
                const res = await request(app)
                    .post('/mcp')
                    .set('X-Forwarded-For', '1.2.3.4')
                    .set('X-Forwarded-Proto', 'https')
                    .set('X-Forwarded-Host', 'mcp.example.com')
                    .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

                expect(res.status).toBe(401);
                expect(res.headers['www-authenticate']).toBe('Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"');
            });

            it('should use BASE_URL if set', async () => {
                process.env.BASE_URL = 'https://custom.domain.com';
                const res = await request(app)
                    .post('/mcp')
                    .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

                expect(res.status).toBe(401);
                expect(res.headers['www-authenticate']).toBe('Bearer resource_metadata="https://custom.domain.com/.well-known/oauth-protected-resource"');
                delete process.env.BASE_URL;
            });
        });
    });
});
