# Configuration Reference

This document describes configuration in three buckets:

- active and verified
- active but still under contract repair
- documented residue that should not be treated as real control until repaired

## Active auth settings

Verified active behaviour:

| Variable | Purpose |
| --- | --- |
| `PERSONAL_CONTEXT_MCP_API_KEY` | Primary bearer token accepted by `/mcp`. |
| `MCP_API_KEY` | Additional single bearer token alias. |
| `MCP_API_KEYS` | Comma-separated additional bearer tokens. |
| `API_KEY_MODE` / `PERSONAL_API_KEY_MODE` | Set to `disabled` to disable bearer-token checks. |

Notes:

- `/mcp` auth is live-validated.
- `/health` remains public.

## Active runtime settings

Verified active behaviour:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Primary database location. |
| `PERSONAL_DATABASE_URL` | Alias for the database location. |
| `GOOGLE_API_KEY` / `PERSONAL_GOOGLE_API_KEY` | Enables reverse geocoding and nearby-place search. |
| `GOOGLE_POLL_CRON` / `PERSONAL_GOOGLE_POLL_CRON` | Enables scheduled Google backfill when valid. |
| `GOOGLE_HTTP_TIMEOUT_MS` / `PERSONAL_GOOGLE_HTTP_TIMEOUT_MS` | Google request timeout. |
| `HA_URL` | Home Assistant base URL. |
| `HA_TOKEN` | Home Assistant access token. |
| `HA_ENTITY_ID` | Home Assistant entity to poll. |
| `HA_TIMEOUT_MS` / `PERSONAL_HA_TIMEOUT_MS` | Home Assistant request timeout. |
| `HA_POLL_INTERVAL_SECONDS` / `PERSONAL_HA_POLL_INTERVAL_SECONDS` | Background HA poll interval. |
| `HA_LOCATION_TTL_SECONDS` / `PERSONAL_HA_LOCATION_TTL_SECONDS` | TTL for HA-derived location records. |
| `LOCATION_STALE_HOURS` | Maximum age for effective location. |
| `HOLIDAY_FETCH_TIMEOUT_MS` | Timeout for GOV.UK holiday fetches. |
| `DATA_RETENTION_DAYS` / `PERSONAL_DATA_RETENTION_DAYS` | Retention window for cleanup. |
| `DATA_CLEANUP_INTERVAL_SECONDS` / `PERSONAL_DATA_CLEANUP_INTERVAL_SECONDS` | Cleanup job interval. |
| `MCP_HOST` / `HOST` | Bind host. |
| `MCP_PORT` / `PORT` | Bind port. |
| `MCP_PATH` | MCP HTTP path. |
| `MCP_TRANSPORT` / `FASTMCP_TRANSPORT` | Transport mode. |

## Settings under contract repair

These settings are active but their surrounding documentation or runtime contract is still being repaired:

| Variable | Current concern |
| --- | --- |
| `DATABASE_URL` | Default path behaviour is now `./data/mcp.db` relative to the current working directory; older docs may still describe the pre-repair path. |
| `PERSONAL_CONTEXT_MCP_PORT` | Used by compose examples, not by core runtime resolution directly. |
| `PERSONAL_CONTEXT_MCP_HOST_PORT` | Compose-only host publishing knob. |
| `PERSONAL_CONTEXT_MCP_PATH` | Compose helper knob rather than the primary runtime path source. |

## Documentary residue

These names may still appear in older docs or examples, but they should not currently be treated as implemented controls:

| Variable | Current state |
| --- | --- |
| `MASTER_KEY` / `PERSONAL_MASTER_KEY` | Not verified as active behaviour. |
| `CODE_TTL_SECONDS` / `PERSONAL_CODE_TTL_SECONDS` | Not part of the active public contract. |
| `TOKEN_TTL_SECONDS` / `PERSONAL_TOKEN_TTL_SECONDS` | Not part of the active public contract. |
| `API_KEY_ISSUE_RATELIMIT` / `PERSONAL_API_KEY_ISSUE_RATELIMIT` | Not verified as enforced. |
| `API_KEY_ISSUE_WINDOW_SECONDS` / `PERSONAL_API_KEY_ISSUE_WINDOW_SECONDS` | Not verified as enforced. |
| `MCP_RATELIMIT_PER_KEY` / `PERSONAL_MCP_RATELIMIT_PER_KEY` | Not verified as enforced. |
| `MCP_RATELIMIT_WINDOW_SECONDS` / `PERSONAL_MCP_RATELIMIT_WINDOW_SECONDS` | Not verified as enforced. |

## Current caution

Do not use this file as proof that a setting is enforced unless it is listed under `active and verified`.

Storage note:

- direct local runs default to `./data/mcp.db`
- the container image runs from `/app`, so the same default resolves to `/app/data/mcp.db`
- the compose mount `./state/data:/app/data` therefore preserves the default container database without requiring an override

For the current repair direction, see:

- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/archive/investigation-report.md`
