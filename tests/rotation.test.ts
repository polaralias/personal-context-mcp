import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyService } from '../src/services/apiKeyService';
import db from '../src/db';
import { apiKeys, userConfigs } from '../src/db/schema';
import { createUserBoundKey } from '../src/services/auth';
import { sql } from 'drizzle-orm';

describe('API Key Rotation Logic', () => {
    let apiKeyService: ApiKeyService;

    beforeEach(() => {
        apiKeyService = ApiKeyService.getInstance();
        vi.clearAllMocks();
        process.env.MASTER_KEY = 'test-master-key'; // Needed for createUserBoundKey encryption

        // Clear DB
        db.delete(apiKeys).run();
        db.delete(userConfigs).run();
    });

    it('revokeInactiveKeys should revoke keys inactive for > 30 days', async () => {
        // Create 3 keys
        // 1. New key (active)
        await createUserBoundKey({});

        // 2. Old key (never used, created > 30 days ago) - Should be revoked
        // We need to manually insert to convert createdAt
        const userConfigId = 'uc-old';
        db.insert(userConfigs).values({ id: userConfigId, serverId: 'def', configEnc: 'enc', createdAt: new Date(), updatedAt: new Date() }).run();

        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 31);

        db.insert(apiKeys).values({
            id: 'key-old',
            userConfigId,
            keyHash: 'hash-old',
            createdAt: oldDate,
            lastUsedAt: null
        }).run();

        // 3. Old key (used recently) - Should NOT be revoked
        const userConfigId2 = 'uc-active';
        db.insert(userConfigs).values({ id: userConfigId2, serverId: 'def', configEnc: 'enc', createdAt: new Date(), updatedAt: new Date() }).run();

        db.insert(apiKeys).values({
            id: 'key-active-old',
            userConfigId: userConfigId2,
            keyHash: 'hash-active',
            createdAt: oldDate,
            lastUsedAt: new Date() // Used now
        }).run();

        // 4. Old key (used > 30 days ago) - Should be revoked
        const userConfigId3 = 'uc-expired';
        db.insert(userConfigs).values({ id: userConfigId3, serverId: 'def', configEnc: 'enc', createdAt: new Date(), updatedAt: new Date() }).run();

        db.insert(apiKeys).values({
            id: 'key-expired',
            userConfigId: userConfigId3,
            keyHash: 'hash-expired',
            createdAt: oldDate,
            lastUsedAt: oldDate
        }).run();

        const revokedCount = await apiKeyService.revokeInactiveKeys();

        expect(revokedCount).toBe(2);

        // Verify
        const allKeys = db.select().from(apiKeys).all();
        const revoked = allKeys.filter(k => k.revokedAt !== null);
        expect(revoked.length).toBe(2);
        expect(revoked.find(k => k.id === 'key-old')).toBeDefined();
        expect(revoked.find(k => k.id === 'key-expired')).toBeDefined();
    });
});
