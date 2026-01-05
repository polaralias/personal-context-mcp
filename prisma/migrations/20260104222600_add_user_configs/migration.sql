-- CreateTable
CREATE TABLE "user_configs" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "config_enc" TEXT NOT NULL,
    "config_fingerprint" TEXT,
    "display_name" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_config_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_ip" TEXT,
    "last_used_ip" TEXT,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_configs_config_fingerprint_idx" ON "user_configs"("config_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_config_id_fkey" FOREIGN KEY ("user_config_id") REFERENCES "user_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
