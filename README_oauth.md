
## OAuth / Redirect URI allowlist

This server implements the OAuth 2.0 authorization code flow. To ensure security, it employs a strict Redirect URI allowlist.

### BASE_URL Requirements
The `BASE_URL` environment variable is **REQUIRED** if you are running behind a reverse proxy (like Cloudflare, Nginx, or Ngrok). It ensures that all OAuth discovery metadata (`/.well-known/oauth-authorization-server`) returns correct, absolute `https://` URLs.

- If not set, the server attempts to infer it from the request headers (`X-Forwarded-Proto`, `Host`).
- If set, it MUST inlcude the scheme (e.g. `https://my-mcp.com`).

### Allowlist Configuration
Control allowed redirect destinations using environment variables:

- `REDIRECT_URI_ALLOWLIST`: Comma-separated list of allowed URIs (e.g., `https://chatgpt.com/,http://localhost:3000/`).
- `REDIRECT_URI_ALLOWLIST_MODE`:
  - `prefix` (Default): Allows any redirect URI that *starts with* one of the allowed entries. Recommended for deployments to avoid frequent updates.
  - `exact`: Requires an exact string match.

### Troubleshooting
If a client fails to register or connect validation fails ("invalid_redirect_uri"), check the server logs. The server logs a structured warning line for every rejection:
```
[WARN] Redirect URI rejected | uri=... | mismatch=... | ip=...
```

### Cloudflare & Bot Fight Mode
If using Cloudflare, ensure "Bot Fight Mode" is NOT blocking the OAuth endpoints (`/register`, `/connect`, `/token`). If Cloudflare presents a "Just a moment..." challenge page to the automated OAuth client, the connection will fail.
