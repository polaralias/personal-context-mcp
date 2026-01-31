import db from '../db';
import { apiKeys } from '../db/schema';
import { and, lt, or, isNull } from 'drizzle-orm';
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

        const result = db.update(apiKeys)
            .set({ revokedAt: new Date() })
            .where(and(
                isNull(apiKeys.revokedAt),
                or(
                    and(isNull(apiKeys.lastUsedAt), lt(apiKeys.createdAt, thirtyDaysAgo)),
                    lt(apiKeys.lastUsedAt, thirtyDaysAgo)
                )
            ))
            .run();

        if (result.changes > 0) {
            logger.info({ count: result.changes }, 'Revoked inactive API keys');
        }

        return result.changes;
    }
}
