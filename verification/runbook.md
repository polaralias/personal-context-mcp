# OAuth Validation Runbook

## Smoke Test (Local)
This script validates:
1.  Metdata endpoints return absolute `https://` URLs.
2.  `POST /register` works for allowed URIs.
3.  `POST /register` fails with the correct error structure and message for disallowed URIs.

**Usage:**
```powershell
./verification/oauth-smoke-test.ps1
```
*Note: Ensure the server is running on `http://localhost:3010` (or update script variable).*

## Bot Check
Validates that endpoints return JSON, not Cloudflare challenges.

**Usage:**
```powershell
./verification/bot-check.ps1
```

## Manual Validation
1.  **Browser Flow**:
    - Build a URL: `https://<YOUR_DOMAIN>/connect?client_id=<ID>&redirect_uri=<ALLOWED_URI>&state=s&code_challenge=foo&code_challenge_method=S256`
    - Verify it loads the Connect UI.
    - Submit and verify redirect to `redirect_uri` with `code` and `state`.
2.  **Logs**:
    - Trigger a rejection (start flow with disallowed URI).
    - Check logs for `[WARN] Redirect URI rejected...`
