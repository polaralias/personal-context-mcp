# personal-context-mcp

Personal Context MCP server for status + location signals, with an HTTP API and MCP endpoints.

## Setup (local)

### Prerequisites

- Node.js 18+
- PostgreSQL

### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env` file (or export env vars directly):

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/status_db
# Optional: Bearer token for MCP endpoint protection. If unset, the MCP endpoint is open.
MCP_BEARER_TOKEN=replace-with-a-token

# REST API protection (status/work, etc)
AUTH_TOKEN=replace-with-a-strong-token

# Home Assistant connector
HA_URL=https://homeassistant.local
HA_TOKEN=replace-with-ha-long-lived-token
HA_ENTITY_ID=device_tracker.my_phone

# Google connector
GOOGLE_API_KEY=replace-with-google-api-key
GOOGLE_POLL_CRON=0 * * * *

# Optional runtime
PORT=3000
LOCATION_STALE_HOURS=6
```

**Required env vars**

| Variable | Required For | Notes |
| --- | --- | --- |
| `DATABASE_URL` | All runtime | Used by Prisma in `src/db.ts`. |
| `AUTH_TOKEN` | Protected REST routes | Used by `src/middleware/auth.ts`. |
| `HA_URL` | Home Assistant polling | Required to enable HA polling in `src/jobs.ts`. |
| `HA_TOKEN` | Home Assistant polling | Required with `HA_URL` in `src/jobs.ts`/`src/connectors/homeassistant.ts`. |
| `GOOGLE_API_KEY` | Google connector polling | Required to enable polling in `src/jobs.ts`/`src/connectors/google.ts`. |

**Related env vars** (optional but commonly used)

- `MCP_BEARER_TOKEN`: If set, requires `Authorization: Bearer <token>` for `/mcp` access.
- `HA_ENTITY_ID`: entity to read in Home Assistant (used by `HomeAssistantConnector`).
- `GOOGLE_POLL_CRON`: cron schedule for Google polling (defaults to hourly).
- `PORT`: server port (default `3000`).
- `LOCATION_STALE_HOURS`: resolver staleness window.

### Database + Prisma

Run migrations and generate Prisma client:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

For production environments (including containers), run:

```bash
npx prisma migrate deploy
npx prisma generate
```

### Run the server

```bash
npm run dev
```

The server defaults to `http://localhost:3000`.

## Local Docker Deployment

This repository includes a `Dockerfile` and `docker-compose.yml` for easy local deployment.

### Requirements

*   Docker Desktop or Docker Engine
*   Docker Compose

### Commands

1.  **Start the stack:**
    ```bash
    docker compose up --build -d
    ```
    This will start the `status-mcp` service on port 3000 and a PostgreSQL database.

2.  **View logs:**
    ```bash
    docker compose logs -f
    ```

3.  **Stop the stack:**
    ```bash
    docker compose down
    ```

### Configuration

You can configure the deployment via environment variables in `docker-compose.yml`.

| Variable | Default (Docker) | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port the application listens on inside the container. |
| `DATABASE_URL` | `postgresql://...` | Connection string for the internal Postgres service. |
| `AUTH_TOKEN` | - | **Important:** Set this to a strong secret for managing REST API access. |
| `HA_URL` | - | URL for Home Assistant integration. |
| `HA_TOKEN` | - | Long-lived access token for Home Assistant. |

## MCP Connection

This server exposes a single MCP endpoint over Streamable HTTP.

**Endpoint:** `http://localhost:3000/mcp` (or your domain)

To connect via an MCP Client (e.g., Claude Desktop, Cursor), configure it to point to this URL.

If `MCP_BEARER_TOKEN` is set, ensure the client sends the `Authorization` header.

### Old SSE Transport
The previous SSE transport at `/mcp/sse` and `/mcp/messages` has been removed in favor of the official MCP Streamable HTTP transport at `/mcp`.

## REST API usage

For manual API calls (e.g., setting status via Curl or Shortcuts), use the `AUTH_TOKEN` set in your environment variables:

```bash
curl -X PUT https://status.yourdomain.com/status \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"working"}'
```

## API docs

- OpenAPI spec: [`openapi.yaml`](./openapi.yaml)
- Swagger UI: `http://localhost:3000/docs` (or `https://status.yourdomain.com/docs`)
