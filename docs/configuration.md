# Configuration Reference

This guide explains the supported environment variables and deployment knobs for `personal-context-mcp`.

## Required settings

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PERSONAL_CONTEXT_MCP_API_KEY` | Recommended | none | Service-specific bearer token accepted by the HTTP MCP endpoint. |
| `DATABASE_URL` or default state volume | No | `sqlite:///data/mcp.db` | Storage location for the persistent SQLite database. |

## MCP client auth

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MCP_API_KEY` | No | none | Generic single-key alias if you prefer a shared naming pattern across services. |
| `MCP_API_KEYS` | No | none | Comma-separated additional bearer tokens accepted by the MCP endpoint. |
| `API_KEY_MODE` / `PERSONAL_API_KEY_MODE` | No | static auth enabled | Set to `disabled` to turn off bearer-token checks entirely. |

## Database and local state

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | No | `sqlite:///data/mcp.db` | Primary database URL. Relative SQLite paths are resolved inside the working directory or container. |
| `PERSONAL_DATABASE_URL` | No | none | Service-specific alias for the database URL. |
| `MASTER_KEY` / `PERSONAL_MASTER_KEY` | No | none | Legacy signing or encryption material retained for compatibility with earlier auth or state flows. |

## Google enrichment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GOOGLE_API_KEY` / `PERSONAL_GOOGLE_API_KEY` | No | none | Google API key used for reverse-geocoding and nearby-place enrichment. |
| `GOOGLE_POLL_CRON` / `PERSONAL_GOOGLE_POLL_CRON` | No | none | Cron schedule controlling any configured Google-driven refresh jobs. |
| `GOOGLE_HTTP_TIMEOUT_MS` / `PERSONAL_GOOGLE_HTTP_TIMEOUT_MS` | No | `5000` | Timeout for outbound Google API requests. |

## Home Assistant integration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `HA_URL` | No | none | Base URL for the Home Assistant instance used for location polling. |
| `HA_TOKEN` | No | none | Long-lived Home Assistant access token. |
| `HA_ENTITY_ID` | No | none | Entity ID that represents the tracked device or person. |
| `HA_TIMEOUT_MS` / `PERSONAL_HA_TIMEOUT_MS` | No | `5000` | Timeout for Home Assistant API requests. |
| `HA_POLL_INTERVAL_SECONDS` / `PERSONAL_HA_POLL_INTERVAL_SECONDS` | No | `60` | Background poll interval for Home Assistant updates. |
| `HA_LOCATION_TTL_SECONDS` / `PERSONAL_HA_LOCATION_TTL_SECONDS` | No | `600` | TTL applied to Home Assistant-derived location records. |

## Retention, TTLs, and rate limits

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `LOCATION_STALE_HOURS` | No | `6` | Age threshold after which a stored location is treated as stale. |
| `HOLIDAY_FETCH_TIMEOUT_MS` | No | `5000` | Timeout for GOV.UK bank-holiday fetches. |
| `DATA_RETENTION_DAYS` / `PERSONAL_DATA_RETENTION_DAYS` | No | `90` | Retention window for historical data cleanup. |
| `DATA_CLEANUP_INTERVAL_SECONDS` / `PERSONAL_DATA_CLEANUP_INTERVAL_SECONDS` | No | `3600` | Cleanup job frequency for expired records. |
| `CODE_TTL_SECONDS` / `PERSONAL_CODE_TTL_SECONDS` | No | `90` | TTL for short-lived auth or verification codes used by retained compatibility flows. |
| `TOKEN_TTL_SECONDS` / `PERSONAL_TOKEN_TTL_SECONDS` | No | `3600` | TTL for short-lived issued tokens used by retained compatibility flows. |
| `API_KEY_ISSUE_RATELIMIT` / `PERSONAL_API_KEY_ISSUE_RATELIMIT` | No | `3` | Maximum key-issue attempts allowed per window. |
| `API_KEY_ISSUE_WINDOW_SECONDS` / `PERSONAL_API_KEY_ISSUE_WINDOW_SECONDS` | No | `3600` | Window length for API-key issue rate limiting. |
| `MCP_RATELIMIT_PER_KEY` / `PERSONAL_MCP_RATELIMIT_PER_KEY` | No | `60` | Maximum MCP requests allowed per API key per window. |
| `MCP_RATELIMIT_WINDOW_SECONDS` / `PERSONAL_MCP_RATELIMIT_WINDOW_SECONDS` | No | `60` | Window length for per-key MCP request limiting. |

## Endpoint and transport

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PERSONAL_CONTEXT_MCP_PORT` | No | `3003` | Internal service port used by the compose examples. |
| `PERSONAL_CONTEXT_MCP_HOST_PORT` | No | `3003` | Host-side published port in the bundled `docker-compose.yml`. |
| `PERSONAL_CONTEXT_MCP_PATH` | No | `/mcp` | HTTP path where the MCP endpoint is exposed. |
| `MCP_HOST` / `HOST` | No | `127.0.0.1` locally, `0.0.0.0` in compose | Host bind address used by `scripts/run_server.py` and FastMCP. |
| `MCP_PORT` / `PORT` | No | `3003` | Generic runtime port override. |
| `MCP_PATH` | No | `/mcp` | Generic runtime path override. |
| `MCP_TRANSPORT` / `FASTMCP_TRANSPORT` | No | `streamable-http` | Transport mode. `stdio` is mainly useful for local tooling and testing. |

## Files and deployment notes

- The bundled compose file assumes the external Docker network `reverse_proxy` already exists.
- The default compose deployment persists SQLite data under `./state/data` so location history and schedules survive container recreation.
- Home Assistant and Google Maps integrations are optional; the core manual schedule and status tools work without them.
