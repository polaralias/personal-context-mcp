# Personal Context MCP Server

An MCP server that aggregates user status signals (location, calendar) and exposes them via the Model Context Protocol.

## Features

- **Status Aggregation:** Combines location and calendar data to determine current user status.
- **MCP Protocol:** Implements `StreamableHTTPServerTransport` at `/mcp`.
- **OAuth 2.0:** Secure authentication with Authorization Code Flow + PKCE.
- **Connect UI:** User-friendly configuration UI at `/connect`.

## Configuration

The server is configured via environment variables.

### Required

*   `DATABASE_URL`: PostgreSQL connection string.
*   `MASTER_KEY`: 32-byte hex string used for encryption. **MUST BE CHANGED FOR PRODUCTION.**
    *   Example: `0000000000000000000000000000000000000000000000000000000000000000`
*   `REDIRECT_URI_ALLOWLIST`: Comma-separated list of allowed redirect URIs.
    *   Example: `http://localhost:3010`

### Optional

*   `REDIRECT_URI_ALLOWLIST_MODE`: Validation mode for redirect URIs.
    *   `exact` (default): Exact match required.
    *   `prefix`: Starts with match required.
*   `CODE_TTL_SECONDS`: Time-to-live for auth codes (default: 300).
*   `TOKEN_TTL_SECONDS`: Time-to-live for access tokens (default: 3600).
*   `GOOGLE_API_KEY`: API Key for Google services (can be set here or via UI).
*   `GOOGLE_POLL_CRON`: Cron schedule for polling Google (default: `0 0 * * *`).
*   `PORT`: Server port (default: 3000).

## OAuth Discovery

The server exposes standard OAuth 2.0 discovery endpoints:

*   `GET /.well-known/oauth-protected-resource`: Identifies the resource and authorization server.
*   `GET /.well-known/oauth-authorization-server`: Advertises endpoints and supported methods.
*   `GET /.well-known/mcp-config`: Standardized configuration schema.

## Smoke Test

To verify the server is working correctly, you can run the provided PowerShell smoke test.

1.  Open `http://localhost:3010/connect?redirect_uri=http://localhost:3010&state=123&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256` in your browser (adjust params as needed).
2.  Complete the configuration steps.
3.  Copy the `code` from the redirect URL.
4.  Run `scripts/smoke-test.ps1`.
5.  Enter the required details when prompted:
    *   Base URL: `http://localhost:3010`
    *   Code: (The code you copied)
    *   Code Verifier: `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` (matches the challenge above)
    *   Redirect URI: `http://localhost:3010`

The script will exchange the code for a token and verify access to the `/mcp` endpoint.

## Development

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

## Production

Use Docker Compose for production deployment.

```bash
docker-compose up -d --build
```

**WARNING:** Ensure you replace the example `MASTER_KEY` and other sensitive values before deploying to production.
