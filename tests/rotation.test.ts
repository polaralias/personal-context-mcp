import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiKeyService } from '../src/services/apiKeyService';
import prisma from '../src/db';

vi.mock('../src/db', () => ({
    default: {
        apiKey: {
            updateMany: vi.fn(),
        },
    }
}));

describe('API Key Rotation Logic', () => {
    let apiKeyService: ApiKeyService;

    beforeEach(() => {
        apiKeyService = ApiKeyService.getInstance();
        vi.clearAllMocks();
    });

    it('revokeInactiveKeys should call prisma.updateMany with correct filters', async () => {
        const mockUpdateMany = vi.mocked(prisma.apiKey.updateMany);
        mockUpdateMany.mockResolvedValue({ count: 5 });

        const count = await apiKeyService.revokeInactiveKeys();

        expect(count).toBe(5);
        expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                revokedAt: null,
                OR: expect.arrayContaining([
                    expect.objectContaining({
                        lastUsedAt: null,
                        createdAt: expect.anything()
                    }),
                    expect.objectContaining({
                        lastUsedAt: expect.anything()
                    })
                ])
            })
        }));
    });
});
