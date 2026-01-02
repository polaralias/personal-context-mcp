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

# Auth Configuration (REQUIRED for Connect Flow)
MASTER_KEY=change-this-to-at-least-32-byte-random-string
REDIRECT_URI_ALLOWLIST=http://localhost:8080/callback

# Google connector
GOOGLE_API_KEY=replace-with-google-api-key
GOOGLE_POLL_CRON=0 * * * *

# Optional runtime
PORT=3000
LOCATION_STALE_HOURS=6
CODE_TTL_SECONDS=90
TOKEN_TTL_SECONDS=3600
```

**Required env vars**

| Variable | Required For | Notes |
| --- | --- | --- |
| `DATABASE_URL` | All runtime | Used by Prisma in `src/db.ts`. |
| `MASTER_KEY` | Auth | Used to encrypt configuration and sign tokens. Must be at least 32 bytes. |
| `REDIRECT_URI_ALLOWLIST` | Auth | Comma-separated list of allowed redirect URIs for the Connect flow. |

**Related env vars** (optional but commonly used)

- `CODE_TTL_SECONDS`: Expiry for auth codes (default 90s).
- `TOKEN_TTL_SECONDS`: Expiry for access tokens (default 3600s).
- `GOOGLE_API_KEY`: Google connector polling.
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

    **Note:** The `docker-compose.yml` contains example values for `MASTER_KEY` and `REDIRECT_URI_ALLOWLIST`. You **MUST** change these for any real deployment.

2.  **View logs:**
    ```bash
    docker compose logs -f
    ```

3.  **Stop the stack:**
    ```bash
    docker compose down
    ```

## Authentication & Connection

This server uses an OAuth-style Authorization Code flow with PKCE (S256).

### Connect Flow

1.  Navigate to `/connect` with the following query parameters:
    *   `redirect_uri`: Must be in `REDIRECT_URI_ALLOWLIST`.
    *   `state`: Random string.
    *   `code_challenge`: PKCE challenge.
    *   `code_challenge_method`: Must be `S256`.
2.  Fill out the configuration form (e.g. Google API Key).
3.  Submit to be redirected back to `redirect_uri` with a `code` and `state`.

### Token Exchange

Exchange the code for an access token:
`POST /token`

```json
{
  "grant_type": "authorization_code",
  "code": "...",
  "code_verifier": "...",
  "redirect_uri": "..."
}
```

Response:
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## MCP Connection

This server supports the MCP Streamable HTTP transport at `/mcp`.

1.  **Endpoint:** `http(s)://<host>/mcp`
2.  **Authentication:** Requires `Authorization: Bearer <token>` header with the token obtained from `/token`.

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
*   `GET /connect`: Configuration and connection UI.
*   `POST /token`: Token exchange endpoint.
*   `GET /.well-known/mcp-config`: Configuration schema.
