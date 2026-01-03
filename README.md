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
*   `MASTER_KEY`: Standardized 32-byte key handling. **MUST BE CHANGED FOR PRODUCTION.**
    *   **Format 1 (Hex):** 64 hex characters (0-9, a-f). Decoded directly to 32 bytes.
        *   Generate (OpenSSL): `openssl rand -hex 32`
        *   Generate (PowerShell): `[BitConverter]::ToString((1..32 | % {Get-Random -Minimum 0 -Maximum 256})).Replace("-","").ToLower()`
    *   **Format 2 (Passphrase):** Any other string. Derived to 32 bytes using SHA-256.
    *   Example: `insecure-master-key-must-be-32-bytes-long` (passphrase)
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

## Deployment

### Docker Deployment

The simplest way to deploy the server is using Docker Compose.

1.  **Configure Environment Variables:**
    Ensure your `docker-compose.yml` (or a `.env` file) has the correct settings. 
    
    > [!IMPORTANT]
    > Update `REDIRECT_URI_ALLOWLIST` to include your public domain if you are using one.
    > Example: `REDIRECT_URI_ALLOWLIST=https://mcp.yourdomain.com/connect`

2.  **Start the Containers:**
    ```bash
    docker-compose up -d --build
    ```

### Nginx Proxy Manager (NPM) Setup

To expose the server securely over HTTPS, we recommend using Nginx Proxy Manager.

#### 1. Add Proxy Host
- **Domain Names:** `mcp.yourdomain.com`
- **Scheme:** `http`
- **Forward Host / IP:** `app` (if in the same Docker network) or the server's IP.
- **Forward Port:** `3010` (as defined in `docker-compose.yml`)

#### 2. SSL Configuration
- Go to the **SSL** tab.
- Select **Request a new SSL Certificate**.
- Enable **Force SSL**, **HTTP/2 Support**, and **HSTS Enabled**.

#### 3. Advanced Configuration (Websockets)
If you plan to use features requiring persistent connections, ensure **Websockets Support** is toggled **ON** in the **Details** tab.

#### 4. Update Application Config
Ensure the `REDIRECT_URI_ALLOWLIST` in your environment matches the public URL configured in NPM.

```bash
# Example update in docker-compose.yml
- REDIRECT_URI_ALLOWLIST=https://mcp.yourdomain.com/connect
```

---

## Smoke Test

To verify the server is working correctly, you can run the provided PowerShell smoke test.

1.  Open `https://mcp.yourdomain.com/connect?redirect_uri=https://mcp.yourdomain.com/connect&state=123&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256` in your browser.
2.  Complete the configuration steps.
3.  Copy the `code` from the redirect URL.
4.  Run `scripts/smoke-test.ps1`.
5.  Enter the required details when prompted:
    *   Base URL: `https://mcp.yourdomain.com`
    *   Code: (The code you copied)
    *   Code Verifier: `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`
    *   Redirect URI: `https://mcp.yourdomain.com/connect`

The script will exchange the code for a token and verify access to the `/mcp` endpoint.
