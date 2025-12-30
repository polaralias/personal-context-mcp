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
| `AUTH_TOKEN` | Protected routes (manual overrides) | Used by `src/middleware/auth.ts`; if unset, only DB session tokens work. |
| `HA_URL` | Home Assistant polling | Required to enable HA polling in `src/jobs.ts`. |
| `HA_TOKEN` | Home Assistant polling | Required with `HA_URL` in `src/jobs.ts`/`src/connectors/homeassistant.ts`. |
| `GOOGLE_API_KEY` | Google connector polling | Required to enable polling in `src/jobs.ts`/`src/connectors/google.ts`. |

**Related env vars** (optional but commonly used)

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
| `AUTH_TOKEN` | - | **Important:** Set this to a strong secret for managing manual overrides. |
| `HA_URL` | - | URL for Home Assistant integration. |
| `HA_TOKEN` | - | Long-lived access token for Home Assistant. |

## Reverse Proxy Setup (Nginx Proxy Manager)

This application is designed to work behind a reverse proxy like Nginx Proxy Manager (NPM).

### Setup Steps in NPM

1.  **Add Proxy Host:**
    *   **Domain Names:** `status.yourdomain.com` (or similar).
    *   **Scheme:** `http`
    *   **Forward Hostname / IP:** The IP address of your Docker host (e.g., `192.168.1.100` or `host.docker.internal` if supported).
    *   **Forward Port:** `3000` (or whatever you mapped in `docker-compose.yml`).
    *   **Block Common Exploits:** Enable.
    *   **Websockets Support:** **Enable** (Required for MCP SSE connection).

2.  **SSL:**
    *   Request a new certificate (Let's Encrypt).
    *   **Force SSL:** Enable.
    *   **HTTP/2 Support:** Enable.

### Proxy Headers
The application is configured to trust proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`). Nginx Proxy Manager handles this automatically by default. This ensures that the application correctly identifies `https` protocol and generates correct redirect URLs during authentication.

## Authentication Flow

The MCP server uses an OAuth-like redirect flow to authenticate clients (like Claude Desktop).

1.  **Initiate Connection:**
    *   Open the MCP Client (e.g., Claude Desktop).
    *   Enter the SSE endpoint: `https://status.yourdomain.com/mcp/sse`.

2.  **Redirect to Configuration:**
    *   The client will open a browser window to `https://status.yourdomain.com/` with a callback URL.
    *   You will see the "Status MCP Configuration" page.

3.  **Authorize:**
    *   Click "Connect & Authorize".
    *   The server generates a secure, short-lived authorization code.
    *   You are redirected back to the client app (via the custom scheme or localhost callback).

4.  **Token Exchange:**
    *   The client exchanges the code for a long-lived session token.
    *   The connection is established.

### Manual API Usage

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
