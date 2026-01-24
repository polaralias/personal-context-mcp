import prisma from '../db';
import { createLogger } from '../logger';

const logger = createLogger('services:apiKeyService');

export class ApiKeyService {
    private static instance: ApiKeyService;

    private constructor() { }

    public static getInstance(): ApiKeyService {
        if (!ApiKeyService.instance) {
            ApiKeyService.instance = new ApiKeyService();
        }
        return ApiKeyService.instance;
    }

    /**
     * Revokes API keys that have been inactive for more than 30 days.
     * @returns Number of keys revoked.
     */
    async revokeInactiveKeys(): Promise<number> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        logger.info('Running inactive API key revocation job...');

        const result = await prisma.apiKey.updateMany({
            where: {
                revokedAt: null,
                OR: [
                    {
                        // Never used and created more than 30 days ago
                        lastUsedAt: null,
                        createdAt: { lt: thirtyDaysAgo }
                    },
                    {
                        // Used, but not within the last 30 days
                        lastUsedAt: { lt: thirtyDaysAgo }
                    }
                ]
            },
            data: {
                revokedAt: new Date()
            }
        });

        if (result.count > 0) {
            logger.info({ count: result.count }, 'Revoked inactive API keys');
        }

        return result.count;
    }
}
