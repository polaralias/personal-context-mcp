# Smoke Test for Personal Context MCP Server

$ErrorActionPreference = "Stop"

function Assert-Success($response, $message) {
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "✅ $message - Success" -ForegroundColor Green
    }
    else {
        Write-Host "❌ $message - Failed with status $($response.StatusCode)" -ForegroundColor Red
        Write-Host $response.Content
        exit 1
    }
}

# 1. Inputs
Write-Host "--- Personal Context MCP Server Smoke Test ---"
$BaseUrl = Read-Host "Enter Base URL (e.g. http://localhost:3010)"
$Code = Read-Host "Enter Auth Code (from browser redirect)"
$CodeVerifier = Read-Host "Enter Code Verifier (PKCE verifier used in browser)"
$RedirectUri = Read-Host "Enter Redirect URI (must match the one used in browser)"

if ([string]::IsNullOrWhiteSpace($BaseUrl)) { $BaseUrl = "http://localhost:3010" }
if ([string]::IsNullOrWhiteSpace($RedirectUri)) { $RedirectUri = "http://localhost:3010" }

# 2. Exchange Code for Token
Write-Host "`nStep 1: Exchanging code for token..."

$tokenBody = @{
    grant_type    = "authorization_code"
    code          = $Code
    code_verifier = $CodeVerifier
    redirect_uri  = $RedirectUri
}

try {
    $tokenResponse = Invoke-WebRequest -Uri "$BaseUrl/token" -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
    Assert-Success $tokenResponse "Token Exchange"

    $tokenJson = $tokenResponse.Content | ConvertFrom-Json
    $accessToken = $tokenJson.access_token
    Write-Host "Got Access Token: $accessToken" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Token Exchange Failed: $_" -ForegroundColor Red
    exit 1
}

# 3. Call MCP Endpoint
Write-Host "`nStep 2: Calling MCP List Tools..."

$mcpBody = @{
    jsonrpc = "2.0"
    method  = "tools/list"
    id      = 1
} | ConvertTo-Json

try {
    $mcpResponse = Invoke-WebRequest -Uri "$BaseUrl/mcp" -Method Post -Body $mcpBody -ContentType "application/json" -Headers @{ "Authorization" = "Bearer $accessToken" }
    Assert-Success $mcpResponse "MCP List Tools"

    $mcpJson = $mcpResponse.Content | ConvertFrom-Json
    $toolsCount = $mcpJson.result.tools.Count
    Write-Host "Found $toolsCount tools." -ForegroundColor Cyan
}
catch {
    Write-Host "❌ MCP Call Failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ SMOKE TEST PASSED" -ForegroundColor Green
