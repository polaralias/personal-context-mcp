import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MIGRATION_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS "clients" (
        "client_id" TEXT PRIMARY KEY,
        "redirect_uris" JSONB NOT NULL,
        "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
        "client_name" TEXT,
        "grant_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "response_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "scope" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "connections" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "config" JSONB,
        "encrypted_secrets" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "sessions" (
        "id" TEXT PRIMARY KEY,
        "connection_id" TEXT NOT NULL REFERENCES "connections"("id") ON DELETE CASCADE,
        "token_hash" TEXT NOT NULL,
        "expires_at" TIMESTAMP(3) NOT NULL,
        "revoked" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "auth_codes" (
        "code" TEXT PRIMARY KEY,
        "connection_id" TEXT NOT NULL REFERENCES "connections"("id") ON DELETE CASCADE,
        "redirect_uri" TEXT NOT NULL,
        "state" TEXT,
        "client_id" TEXT NOT NULL REFERENCES "clients"("client_id") ON DELETE CASCADE,
        "code_challenge" TEXT NOT NULL,
        "code_challenge_method" TEXT NOT NULL,
        "expires_at" TIMESTAMP(3) NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "user_configs" (
        "id" TEXT PRIMARY KEY,
        "server_id" TEXT NOT NULL,
        "config_enc" TEXT NOT NULL,
        "config_fingerprint" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS "user_configs_config_fingerprint_idx" ON "user_configs"("config_fingerprint")`,
    `CREATE TABLE IF NOT EXISTS "api_keys" (
        "id" TEXT PRIMARY KEY,
        "user_config_id" TEXT NOT NULL REFERENCES "user_configs"("id") ON DELETE CASCADE,
        "key_hash" TEXT NOT NULL,
        "created_ip" TEXT,
        "last_used_at" TIMESTAMP(3),
        "revoked_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys"("key_hash")`,
    `CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys"("key_hash")`
];

export const runMigrations = async (retries = 5, delayMs = 3000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await prisma.$transaction(async (tx) => {
                for (const statement of MIGRATION_STATEMENTS) {
                    await tx.$executeRawUnsafe(statement);
                }
            });
            return;
        } catch (error) {
            if (i === retries - 1) throw error;
            console.warn(`[DB] Migration attempt ${i + 1} failed (likely database still initializing), retrying in ${delayMs}ms...`);
            await new Promise(res => setTimeout(res, delayMs));
        }
    }
};

export default prisma;
