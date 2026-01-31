# Personal Context MCP Server

An MCP server that aggregates user status signals (location, calendar) and exposes them via the Model Context Protocol.

## Features

- **Status Aggregation:** Combines location and calendar data to determine current user status.
- **MCP Protocol:** Implements `StreamableHTTPServerTransport` at `/mcp`.
- **OAuth 2.0:** Secure authentication with Authorization Code Flow + PKCE.
- **Dynamic Client Registration:** Supports RFC 7591 for compatibility with clients like ChatGPT.
- **Connect UI:** User-friendly configuration UI at `/connect`.

## Configuration

The server is configured via environment variables.

### Required

*   `DATABASE_URL`: SQLite connection string (e.g., `sqlite:///data/mcp.db` or `sqlite:mcp.db`).
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
*   `CODE_TTL_SECONDS`: Time-to-live for auth codes (default: 90).
*   `TOKEN_TTL_SECONDS`: Time-to-live for access tokens (default: 3600).
*   `GOOGLE_API_KEY`: API Key for Google services (can be set here or via UI).
*   `GOOGLE_POLL_CRON`: Cron schedule for polling Google (default: `0 0 * * *`).
*   `PORT`: Server port (default: 3000).
*   `MCP_API_KEY`: A single API key for simple header/query auth.
*   `MCP_API_KEYS`: Comma-separated list of additional valid API keys.

## Authentication

The server supports two authentication methods for the `/mcp` endpoint:

### 1. OAuth 2.0 (Bearer Token)
Standard OAuth 2.0 Authorization Code Flow + PKCE. Use the `/connect` UI to generate a connection and obtain a token via the `/token` endpoint.

**Header:** `Authorization: Bearer <access_token>`

### 2. API Key (Fallback)
A simple API key method for clients that do not support OAuth flows. Query-string auth is a potential route for clients that cannot send headers, but it is not recommended.

**Header:** `x-api-key: <api_key>`
**Query Param:** `?apiKey=<api_key>` (not recommended)

#### Examples

**Using curl (Header):**
```bash
curl -X POST http://localhost:3010/mcp \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

**Using curl (Query Param, not recommended):**
```bash
curl -X POST "http://localhost:3010/mcp?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Discovery Endpoints

The server exposes standard MCP and OAuth 2.0 discovery endpoints. The behavior depends on the base URL used for discovery:

### 1. API Key Discovery (Root URL)
When a client connects to the **Base URL** (e.g. `https://mcp.yourdomain.com`), it prioritizes the API key configuration flow.
*   `GET /.well-known/mcp`: Returns `config_endpoint` for user-bound API key setup.
*   `GET /.well-known/mcp-configuration`: Alias for compatibility.

### 2. OAuth Discovery (`/oauth` Path)
When a client connects to the **OAuth URL** (e.g. `https://mcp.yourdomain.com/oauth`), it prioritizes the secure OAuth 2.0 flow.
*   `GET /oauth/.well-known/mcp`: Returns `oauth_protected_resource` to trigger OAuth.
*   `GET /oauth/.well-known/oauth-authorization-server`: Advertises OAuth endpoints.

## Dynamic Client Registration (RFC 7591)

The server supports RFC 7591 Dynamic Client Registration, allowing clients like ChatGPT to self-register.

### Verification

1.  **Check Metadata:** `GET /oauth/.well-known/oauth-authorization-server` should contain `"registration_endpoint": "https://<your-domain>/oauth/register"`.
2.  **Test Registration:**
    ```bash
    curl -X POST https://<your-domain>/oauth/register \
      -H "Content-Type: application/json" \
      -d '{
        "redirect_uris": ["https://<your-domain>/callback"],
        "client_name": "Test Client"
      }'
    ```
    Should return a `client_id`.

## Smoke Test (DCR + OAuth)

A comprehensive smoke test for DCR and OAuth is available at `scripts/dcr-smoke-test.ps1`. This script simulates the full flow required by ChatGPT.

1.  Run `scripts/dcr-smoke-test.ps1`.
2.  Provide your server's Base URL (e.g., `http://localhost:3010`).
3.  The script will register a new client and provide an authorization URL.
4.  Open the URL in your browser, complete the setup, and copy the resulting `code`.
5.  Paste the `code` back into the script to complete the token exchange and verify `/mcp` access.

## Development

```bash
# Requires Node.js >= 18.18 (Prisma 6)
# Install dependencies
npm install



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

---

## Self-Serve API Key Provisioning

For clients that do not support OAuth, this server supports a self-serve API key provisioning flow.

### Setup (Server Admin)

1.  Set `API_KEY_MODE=user_bound` in your environment (e.g., in `docker-compose.yml`).
2.  Ensure `MASTER_KEY` is set securely.


### Usage (Client)

1.  Navigate to the root URL of the MCP server in a browser (e.g., `http://localhost:3010/`).
2.  Fill in the configuration form (e.g., Google Maps API Key, Home Location).
3.  Click "Generate API Key".
4.  Copy the API Key (starts with `sk_mcp_`).

### Using the Key

In your MCP client configuration, add the key as a header:

**Option 1: Authorization Header (Preferred)**
```
Authorization: Bearer sk_mcp_...
```

**Option 2: X-API-Key Header**
```
X-API-Key: sk_mcp_...
```

Query-string keys are supported for clients that cannot send headers, but this is not recommended.

The server will automatically load your specific configuration (e.g., your personal Google Maps key) for requests made with this key.

### Key Management

- **Revocation**: Send a POST request to `/api-keys/revoke` with the key in the Authorization header.
- **Rate Limits**: Key issuance is limited (default 3/hour). usage is limited (default 60/min).
