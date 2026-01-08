import prisma from '../db';
import crypto from 'crypto';
import { encryptConfig, decryptConfig } from './auth';
import { createLogger } from '../logger';
import { validateConfig } from '../config/schema/personal-context';

const logger = createLogger('service:apiKey');
const INSECURE_DEFAULT_KEY = 'insecure-master-key-must-be-32-bytes-long';

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
     * Generates a crypographically secure API key.
     * Format: sk_mcp_[32 random bytes hex]
     */
    private generateKey(): string {
        return `sk_mcp_${crypto.randomBytes(32).toString('hex')}`;
    }

    /**
     * Hashes the API key for storage.
     */
    private hashKey(key: string): string {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    /**
     * Provisions a new API key for the given configuration.
     */
    async provisionKey(config: any, ip: string, serverId: string = 'personal-context') {
        // 1. Validate config
        const start = Date.now();
        const configResult = validateConfig(config);

        if (!configResult.success) {
            throw new Error(`Invalid configuration: ${configResult.error.message}`);
        }

        // 2. Encrypt config
        // Ensure we are not using the insecure default in production
        if (process.env.MASTER_KEY === INSECURE_DEFAULT_KEY && process.env.NODE_ENV === 'production') {
            logger.warn('Provisioning key with insecure MASTER_KEY in production!');
        }

        const configEnc = encryptConfig(configResult.data);

        // 3. Create fingerprint for deduplication (optional, using sorted JSON)
        const configFingerprint = crypto
            .createHash('sha256')
            .update(JSON.stringify(configResult.data, Object.keys(configResult.data).sort()))
            .digest('hex');

        // 4. Generate Key
        const rawKey = this.generateKey();
        const keyHash = this.hashKey(rawKey);

        // 5. Transaction to store
        const result = await prisma.$transaction(async (tx) => {
            // Create or find UserConfig
            // We create a new one every time to allow rotation/updates easily, 
            // but could dedupe based on fingerprint if desired. 
            // For now, let's create new to enable independent revocation.
            const userConfig = await tx.userConfig.create({
                data: {
                    serverId,
                    configEnc,
                    configFingerprint,
                    displayName: `Config via ${ip} at ${new Date().toISOString()}`,
                }
            });

            const apiKey = await tx.apiKey.create({
                data: {
                    userConfigId: userConfig.id,
                    keyHash,
                    createdIp: ip,
                }
            });

            return { apiKey, userConfig };
        });

        logger.info({
            userConfigId: result.userConfig.id,
            durationMs: Date.now() - start
        }, 'Provisioned new API Key');

        return {
            key: rawKey,
            userConfigId: result.userConfig.id
        };
    }

    /**
     * Validates an API key and returns the associated configuration.
     * Updates lastUsedAt asynchronously.
     */
    async validateKey(rawKey: string, ip: string) {
        if (!rawKey || !rawKey.startsWith('sk_mcp_')) {
            return null;
        }

        const keyHash = this.hashKey(rawKey);

        const apiKey = await prisma.apiKey.findUnique({
            where: { keyHash },
            include: { userConfig: true }
        });

        if (!apiKey) {
            return null; // Not found
        }

        if (apiKey.revokedAt || apiKey.userConfig.revokedAt) {
            return null; // Revoked
        }

        // Async update stats (fire and forget for perf)
        // Use raw query or separate operation to minimal overhead
        // We throttle this to avoid DB hot spotting in real implementations
        // For simplicity here, we validly update it.
        prisma.apiKey.update({
            where: { id: apiKey.id },
            data: {
                lastUsedAt: new Date(),
                lastUsedIp: ip
            }
        }).catch(err => logger.error({ err }, 'Failed to update key stats'));

        try {
            const config = decryptConfig(apiKey.userConfig.configEnc);
            return {
                config,
                metadata: {
                    keyId: apiKey.id,
                    userConfigId: apiKey.userConfig.id,
                    created: apiKey.createdAt
                }
            };
        } catch (error) {
            logger.error({ err: error, keyId: apiKey.id }, 'Failed to decrypt config for valid key');
            return null;
        }
    }

    async revokeKey(rawKey: string) {
        const keyHash = this.hashKey(rawKey);
        await prisma.apiKey.update({
            where: { keyHash },
            data: { revokedAt: new Date() }
        });
    }

    async revokeConfig(configId: string) {
        await prisma.userConfig.update({
            where: { id: configId },
            data: { revokedAt: new Date() }
        });
    }

    /**
     * Revokes all API keys that have not been used for more than 30 days.
     * Refreshing logic: Active use within 30 days keeps the key alive.
     */
    async revokeInactiveKeys() {
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
            logger.info({ Count: result.count }, 'Revoked inactive API keys');
        }

        return result.count;
    }
}
