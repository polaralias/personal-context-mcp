import { integer, real, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const workStatusEvents = sqliteTable('work_status_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  source: text('source').notNull(),
  status: text('status').notNull(),
  reason: text('reason'),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
}, (table) => ({
  createdAtIdx: index('work_status_events_created_at_idx').on(table.createdAt),
}));

export const locationEvents = sqliteTable('location_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  source: text('source').notNull(),
  latitude: real('lat').notNull(),
  longitude: real('lon').notNull(),
  name: text('name'),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
}, (table) => ({
  createdAtIdx: index('location_events_created_at_idx').on(table.createdAt),
}));

export const scheduledStatus = sqliteTable('scheduled_status', {
  date: text('date').primaryKey(),
  patch: text('patch', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const bankHolidayCache = sqliteTable('bank_holidays_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  region: text('region').notNull(),
  year: integer('year').notNull(),
  payload: text('payload', { mode: 'json' }).$type<unknown[]>().notNull(),
  fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  regionYearUnique: uniqueIndex('bank_holidays_cache_region_year_idx').on(table.region, table.year),
}));

export const clients = sqliteTable('clients', {
  clientId: text('client_id').primaryKey(),
  redirectUris: text('redirect_uris', { mode: 'json' }).$type<string[]>().notNull(),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull(),
  clientName: text('client_name'),
  grantTypes: text('grant_types', { mode: 'json' }).$type<string[]>().notNull(),
  responseTypes: text('response_types', { mode: 'json' }).$type<string[]>().notNull(),
  scope: text('scope'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const connections = sqliteTable('connections', {
  id: text('id').primaryKey(),
  name: text('name'),
  config: text('config', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  encryptedSecrets: text('encrypted_secrets').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  revoked: integer('revoked', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const authCodes = sqliteTable('auth_codes', {
  code: text('code').primaryKey(),
  connectionId: text('connection_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  state: text('state'),
  clientId: text('client_id').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const userConfigs = sqliteTable('user_configs', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  configEnc: text('config_enc').notNull(),
  configFingerprint: text('config_fingerprint'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  configFingerprintIdx: index('user_configs_config_fingerprint_idx').on(table.configFingerprint),
}));

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userConfigId: text('user_config_id').notNull(),
  keyHash: text('key_hash').notNull(),
  createdIp: text('created_ip'),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  keyHashUnique: uniqueIndex('api_keys_key_hash_key').on(table.keyHash),
  keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
}));

export const cache = sqliteTable('cache', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});