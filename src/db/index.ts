import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const DEFAULT_DB_URL = 'sqlite:///data/mcp.db';

const resolveDatabasePath = (databaseUrl: string) => {
  const trimmed = databaseUrl.trim();
  const memoryValues = new Set([':memory:', 'sqlite::memory:', 'file::memory:']);

  if (memoryValues.has(trimmed)) {
    return { path: ':memory:', isMemory: true };
  }

  let withoutScheme = trimmed;
  if (trimmed.startsWith('sqlite:')) {
    withoutScheme = trimmed.slice('sqlite:'.length);
  } else if (trimmed.startsWith('file:')) {
    withoutScheme = trimmed.slice('file:'.length);
  }

  if (withoutScheme.startsWith('//')) {
    withoutScheme = withoutScheme.slice(2);
  }

  if (withoutScheme === ':memory:') {
    return { path: ':memory:', isMemory: true };
  }

  if (withoutScheme.startsWith('/') && /^[A-Za-z]:/.test(withoutScheme.slice(1))) {
    withoutScheme = withoutScheme.slice(1);
  }

  const normalizedPath = path.isAbsolute(withoutScheme)
    ? withoutScheme
    : path.resolve(process.cwd(), withoutScheme);

  return { path: normalizedPath, isMemory: false };
};

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const databaseUrl = process.env.DATABASE_URL || (isTestEnv ? 'sqlite::memory:' : DEFAULT_DB_URL);
const resolved = resolveDatabasePath(databaseUrl);
const dbFileExists = !resolved.isMemory && fs.existsSync(resolved.path);

if (!resolved.isMemory) {
  fs.mkdirSync(path.dirname(resolved.path), { recursive: true });
}

const sqlite = new Database(resolved.isMemory ? ':memory:' : resolved.path);

// Apply safety-related pragmas immediately after opening the DB.
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

const SCHEMA_STATEMENTS = [
  sql`CREATE TABLE IF NOT EXISTS work_status_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    expires_at INTEGER
  )`,
  sql`CREATE INDEX IF NOT EXISTS work_status_events_created_at_idx ON work_status_events (created_at)`,
  sql`CREATE TABLE IF NOT EXISTS location_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    name TEXT,
    expires_at INTEGER
  )`,
  sql`CREATE INDEX IF NOT EXISTS location_events_created_at_idx ON location_events (created_at)`,
  sql`CREATE TABLE IF NOT EXISTS scheduled_status (
    date TEXT PRIMARY KEY,
    patch TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  sql`CREATE TABLE IF NOT EXISTS bank_holidays_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL,
    year INTEGER NOT NULL,
    payload TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS bank_holidays_cache_region_year_idx ON bank_holidays_cache (region, year)`,
  sql`CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY,
    redirect_uris TEXT NOT NULL,
    token_endpoint_auth_method TEXT NOT NULL,
    client_name TEXT,
    grant_types TEXT NOT NULL,
    response_types TEXT NOT NULL,
    scope TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  sql`CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT,
    config TEXT,
    encrypted_secrets TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  sql`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  sql`CREATE TABLE IF NOT EXISTS auth_codes (
    code TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    state TEXT,
    client_id TEXT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  sql`CREATE TABLE IF NOT EXISTS user_configs (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    config_enc TEXT NOT NULL,
    config_fingerprint TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  sql`CREATE INDEX IF NOT EXISTS user_configs_config_fingerprint_idx ON user_configs (config_fingerprint)`,
  sql`CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_config_id TEXT NOT NULL REFERENCES user_configs(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    created_ip TEXT,
    last_used_at INTEGER,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_key ON api_keys (key_hash)`,
  sql`CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash)`,
  sql`CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
];

let initialized = false;

export const initDatabase = () => {
  if (initialized) return;

  if (resolved.isMemory || !dbFileExists) {
    for (const statement of SCHEMA_STATEMENTS) {
      db.run(statement);
    }
  }

  initialized = true;
};

if (isTestEnv) {
  initDatabase();
}

export default db;