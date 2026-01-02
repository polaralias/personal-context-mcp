# personal-context-mcp

Personal Context MCP server for status + location signals, exposed as MCP tools.

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

## MCP Connection

This server supports the MCP Streamable HTTP transport at `/mcp`.

1.  **Endpoint:** `http(s)://<host>/mcp`
2.  **Authentication:** Requires `Authorization: Bearer <token>` header if `MCP_BEARER_TOKEN` is set.

### Available Tools

| Tool Name | Description | Inputs |
| :--- | :--- | :--- |
| `status_get` | Get resolved status for now or a specific date | `date` (YYYY-MM-DD, optional) |
| `status_set_override` | Set manual status override | `status` (string), `reason` (string, optional), `ttlSeconds` (number, optional) |
| `status_get_work` | Get only work status | `date` (YYYY-MM-DD, optional) |
| `status_set_work` | Set manual work status override | `workStatus` (string), `reason` (string, optional), `ttlSeconds` (number, optional) |
| `status_get_location` | Get only location status | (none) |
| `status_set_location` | Set manual location | `latitude` (number), `longitude` (number), `locationName` (string, optional), `source` (string, default 'manual'), `ttlSeconds` (number, optional) |
| `status_get_location_history` | Get location history | `from` (string, optional), `to` (string, optional), `limit` (number, optional) |
| `status_schedule_set` | Set scheduled override for a date | `date` (YYYY-MM-DD), `workStatus` (string, optional), `location` (object, optional), `reason` (string, optional) |
| `status_schedule_list` | List scheduled overrides | `from` (string, optional), `to` (string, optional) |
| `status_schedule_delete` | Delete scheduled override | `date` (string) |
| `holidays_list` | List holidays for current year | `region` (string, optional) |

### Operational Endpoints

*   `GET /health`: Health check.
*   `GET /docs`: Swagger UI (documenting available tools/schemas).
*   `GET /`: Configuration UI.

