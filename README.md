# personal-context-mcp

Standalone Python/FastMCP server for Personal Context with direct HTTP transport, static API-key auth, and persistent local state.

## Highlights

- Default MCP endpoint: `http://localhost:3003/mcp`
- Default health endpoint: `http://localhost:3003/health`
- Supports `PERSONAL_CONTEXT_MCP_API_KEY`, `MCP_API_KEY`, or `MCP_API_KEYS`
- Persists the SQLite database under `./state/data`
- Preserves Home Assistant polling and Google Maps enrichment configuration

## Configuration

1. Copy `.env.example` to `.env`
2. Fill in the required value:
   - `PERSONAL_CONTEXT_MCP_API_KEY`
3. Add any integrations you use:
   - `HA_URL`, `HA_TOKEN`, `HA_ENTITY_ID`
   - `GOOGLE_API_KEY` or `PERSONAL_GOOGLE_API_KEY`

Common optional settings:

- `GOOGLE_POLL_CRON`
- `PERSONAL_CONTEXT_MCP_PORT`
- `PERSONAL_CONTEXT_MCP_HOST_PORT`
- `PERSONAL_CONTEXT_MCP_PATH`
- `DATABASE_URL`
- `LOCATION_STALE_HOURS`
- `DATA_RETENTION_DAYS`
- `DATA_CLEANUP_INTERVAL_SECONDS`
- `API_KEY_MODE`
- `PERSONAL_API_KEY_MODE`

Docker Compose note:

- If a secret contains a literal `$`, escape it as `$$` in `.env`

## Run Locally

```bash
python scripts/run_server.py serve
python scripts/run_server.py doctor
python scripts/run_server.py url
```

The local helper serves streamable HTTP on `MCP_HOST` / `MCP_PORT` / `MCP_PATH`.

## Run With Docker Compose

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f
```

The included `docker-compose.yml` publishes the server on port `3003`, joins the external `reverse_proxy` network, and persists the runtime database under `./state/data`.

## Add To A Shared MCP Compose Project

Use this service in a larger compose stack when you want one project containing multiple MCP servers:

```yaml
services:
  personal-context-mcp:
    build:
      context: /path/to/personal-context-mcp
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - /path/to/personal-context-mcp/.env
    environment:
      MCP_HOST: 0.0.0.0
      MCP_PORT: "3003"
      MCP_PATH: /mcp
    volumes:
      - /path/to/personal-context-mcp/state/data:/app/data
    ports:
      - "3003:3003"
    networks:
      - reverse_proxy

networks:
  reverse_proxy:
    external: true
```

If you do not need host port publishing because you are fronting the service with another internal proxy, you can omit the `ports` section.

## MCP Client Connection

- URL: `http://<host>:<port>/mcp`
- Header: `Authorization: Bearer <your-api-key>`

## Repository Notes

- Health responses identify the server as `personal-context-mcp`
- The server keeps the existing location, schedule, retention, and integration behaviors intact
