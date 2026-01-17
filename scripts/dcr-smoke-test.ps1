# DCR Smoke Test Script
# This script tests the Dynamic Client Registration and OAuth flow

$BASE_URL = "http://localhost:3000"
if ($args.Count -gt 0) { $BASE_URL = $args[0] }

Write-Host "--- 1. Discovery ---" -ForegroundColor Cyan
$metadata = Invoke-RestMethod -Uri "$BASE_URL/.well-known/oauth-authorization-server"
Write-Host "Registration Endpoint: $($metadata.registration_endpoint)"
if (-not $metadata.registration_endpoint) { Write-Error "Metadata missing registration_endpoint"; exit 1 }

Write-Host "`n--- 2. Registration ---" -ForegroundColor Cyan
$regData = @{
    redirect_uris              = @("http://localhost:8080/callback")
    client_name                = "Smoke Test Client"
    token_endpoint_auth_method = "none"
}
$regResponse = Invoke-RestMethod -Uri $metadata.registration_endpoint -Method Post -Body ($regData | ConvertTo-Json) -ContentType "application/json"
$client_id = $regResponse.client_id
Write-Host "Registered Client ID: $client_id"

Write-Host "`n--- 3. Authorize URL Generation ---" -ForegroundColor Cyan
$state = [guid]::NewGuid().ToString()
$code_verifier = "thisshouldbealongerrandomstringthathasenoughbits"
# Generate S256 challenge to match the verifier used during token exchange.
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hash = $sha256.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($code_verifier))
$code_challenge = [Convert]::ToBase64String($hash).TrimEnd("=").Replace("+", "-").Replace("/", "_")
$scope = "openid"

$auth_url = "$($metadata.authorization_endpoint)?client_id=$client_id&redirect_uri=http://localhost:8080/callback&response_type=code&state=$state&code_challenge=$code_challenge&code_challenge_method=S256"
Write-Host "Authorize URL: $auth_url"
Write-Host "Please open this URL in your browser, connect, and paste the 'code' from the redirect URL here." -ForegroundColor Yellow
$code = Read-Host "Enter code"

Write-Host "`n--- 4. Token Exchange ---" -ForegroundColor Cyan
# For this smoke test to work with a manually entered code, the verifier must match the challenge used.
$tokenData = @{
    grant_type    = "authorization_code"
    code          = $code
    redirect_uri  = "http://localhost:8080/callback"
    client_id     = $client_id
    code_verifier = $code_verifier
}

try {
    $tokenResponse = Invoke-RestMethod -Uri $metadata.token_endpoint -Method Post -Body $tokenData
    Write-Host "Access Token received!" -ForegroundColor Green
    $access_token = $tokenResponse.access_token

    Write-Host "`n--- 5. Call /mcp ---" -ForegroundColor Cyan
    $mcpResponse = Invoke-RestMethod -Uri "$BASE_URL/mcp" -Method Post -Headers @{ Authorization = "Bearer $access_token" } -Body (@{ method = "tools/list"; params = @{} } | ConvertTo-Json) -ContentType "application/json"
    Write-Host "MCP Response: " -NoNewline
    Write-Host ($mcpResponse | ConvertTo-Json -Depth 5) -ForegroundColor Gray
}
catch {
    Write-Error "Token exchange or MCP call failed: $_"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $resp = $reader.ReadToEnd()
        Write-Host "Error Detail: $resp" -ForegroundColor Red
    }
}
