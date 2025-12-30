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

## Docker / Compose

Build and run the app + Postgres:

```bash
docker compose up --build
```

Update environment variables in `docker-compose.yml` (or switch to a `.env` file) to include
`AUTH_TOKEN`, `HA_URL`, `HA_TOKEN`, `HA_ENTITY_ID`, and `GOOGLE_API_KEY`.

## API docs

- OpenAPI spec: [`openapi.yaml`](./openapi.yaml)
- Swagger UI: `http://localhost:3000/docs`

## MCP auth flow

The MCP auth flow is implemented in `src/routes/auth.ts` under `/api/auth`.

1. **Authorize**

   `POST /api/auth/authorize`

   ```json
   {
     "callbackUrl": "https://client.example.com/callback",
     "state": "optional-state",
     "connectionUrl": "https://client.example.com",
     "config": { "any": "json" }
   }
   ```

   Response:

   ```json
   {
     "redirectUrl": "https://client.example.com/callback?code=...&state=..."
   }
   ```

2. **Token exchange**

   `POST /api/auth/token`

   ```json
   { "code": "..." }
   ```

   Response includes a bearer token for protected routes:

   ```json
   {
     "access_token": "...",
     "token_type": "Bearer",
     "expires_in": 2592000
   }
   ```

Use the `access_token` as a `Bearer` token for protected endpoints such as `PUT /status` and `PUT /status/work`.

## /status examples

Get the resolved status:

```bash
curl http://localhost:3000/status
```

Override status (requires `AUTH_TOKEN` or a session token):

```bash
curl -X PUT http://localhost:3000/status \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"working","reason":"manual override","ttlSeconds":3600}'
```

Get work-only status:

```bash
curl http://localhost:3000/status/work
```
