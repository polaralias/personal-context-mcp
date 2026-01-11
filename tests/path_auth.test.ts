import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { hashString } from '../src/services/auth';

// Mock dependencies
const { mocks, prismaMock } = vi.hoisted(() => {
    return {
        mocks: {
            validateApiKey: vi.fn(),
            decryptConfig: vi.fn(),
            hashString: vi.fn(),
        },
        prismaMock: {
            apiKey: {
                findUnique: vi.fn(),
                update: vi.fn().mockReturnValue({ catch: vi.fn() }),
            },
        }
    };
});

vi.mock('../src/services/auth', () => {
    return {
        validateApiKey: mocks.validateApiKey,
        decryptConfig: mocks.decryptConfig,
        hashString: (s: string) => s + '_hashed', // Mock hash implementation
        getConnection: vi.fn(),
    };
});

vi.mock('../src/db', () => ({
    default: prismaMock,
}));

import app from '../src/index';

describe('Path-based API Key Authentication', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.API_KEY_MODE = 'user_bound';
        process.env.MASTER_KEY = 'test_master_key';
    });

    it('should authenticate via /key=:apiKey', async () => {
        const testKey = 'mcp_sk_test_key';
        const hashedKey = testKey + '_hashed';

        prismaMock.apiKey.findUnique.mockResolvedValue({
            id: 'key-123',
            revokedAt: null,
            userConfig: {
                configEnc: 'encrypted_config'
            }
        });

        mocks.decryptConfig.mockReturnValue({ test: 'config' });

        const res = await request(app)
            .post(`/key=${testKey}`)
            .send({
                method: "notifications/initialized",
                params: {}
            });

        expect(prismaMock.apiKey.findUnique).toHaveBeenCalledWith({
            where: { keyHash: hashedKey },
            include: { userConfig: true }
        });
        expect(res.status).not.toBe(401);
    });

    it('should authenticate via /key=:apiKey/mcp', async () => {
        const testKey = 'mcp_sk_test_key_2';
        const hashedKey = testKey + '_hashed';

        prismaMock.apiKey.findUnique.mockResolvedValue({
            id: 'key-456',
            revokedAt: null,
            userConfig: {
                configEnc: 'encrypted_config_2'
            }
        });

        mocks.decryptConfig.mockReturnValue({ test: 'config_2' });

        const res = await request(app)
            .post(`/key=${testKey}/mcp`)
            .send({
                method: "notifications/initialized",
                params: {}
            });

        expect(prismaMock.apiKey.findUnique).toHaveBeenCalledWith({
            where: { keyHash: hashedKey },
            include: { userConfig: true }
        });
        expect(res.status).not.toBe(401);
    });

    it('should fail with invalid key in path', async () => {
        const testKey = 'mcp_sk_invalid';
        prismaMock.apiKey.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .post(`/key=${testKey}`)
            .send({
                method: "notifications/initialized",
                params: {}
            });

        expect(res.status).toBe(401);
    });
});
