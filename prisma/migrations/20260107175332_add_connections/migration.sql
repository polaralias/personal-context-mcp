-- CreateTable
CREATE TABLE "work_status_events" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "work_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_events" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "name" TEXT,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "location_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_status" (
    "date" TEXT NOT NULL,
    "patch" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_status_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "bank_holidays_cache" (
    "id" SERIAL NOT NULL,
    "region" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_holidays_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "display_name" TEXT,
    "config_encrypted" TEXT NOT NULL,
    "config_version" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_codes" (
    "id" SERIAL NOT NULL,
    "code_hash" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registered_clients" (
    "id" TEXT NOT NULL,
    "client_name" TEXT,
    "redirect_uris" TEXT[],
    "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
    "grant_types" TEXT[],
    "response_types" TEXT[],
    "scope" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registered_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_status_events_created_at_idx" ON "work_status_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "location_events_created_at_idx" ON "location_events"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bank_holidays_cache_region_year_key" ON "bank_holidays_cache"("region", "year");

-- CreateIndex
CREATE UNIQUE INDEX "auth_codes_code_hash_key" ON "auth_codes"("code_hash");

-- CreateIndex
CREATE INDEX "auth_codes_code_hash_idx" ON "auth_codes"("code_hash");

-- AddForeignKey
ALTER TABLE "auth_codes" ADD CONSTRAINT "auth_codes_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
