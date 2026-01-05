$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:3000"

# 1. Unauthenticated /mcp check
Write-Host "1. Checking unauthenticated /mcp access..."
try {
    Invoke-RestMethod -Uri "$BaseUrl/mcp" -Method Post -Body (@{jsonrpc = "2.0"; method = "tools/list"; id = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
    Write-Error "Should have failed with 401"
}
catch {
    if ($_.Exception.Response.StatusCode -ne [System.Net.HttpStatusCode]::Unauthorized) {
        Write-Error "Expected 401, got $($_.Exception.Response.StatusCode)"
    }
    else {
        Write-Host "   Success: Got 401"
    }
}

# 2. Provision Key
Write-Host "2. Provisioning User-Bound API Key..."
$config = @{
    config                  = @{
        googleApiKey = "test-key";
        projectId    = "test-project"
    };
    "cf-turnstile-response" = "dummy-token"
}

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api-keys" -Method Post -Body ($config | ConvertTo-Json) -ContentType "application/json"
    $apiKey = $response.apiKey
    
    if (-not $apiKey) {
        Write-Error "Failed to receive API key"
    }
    Write-Host "   Success: Received key $apiKey"
}
catch {
    Write-Error "Provisioning failed: $_"
}

# 3. Authenticated Call (Bearer)
Write-Host "3. Checking Authenticated Access (Bearer)..."
try {
    $headers = @{ Authorization = "Bearer $apiKey" }
    Invoke-RestMethod -Uri "$BaseUrl/mcp" -Method Post -Body (@{jsonrpc = "2.0"; method = "tools/list"; id = 1 } | ConvertTo-Json) -ContentType "application/json" -Headers $headers | Out-Null
    Write-Host "   Success: Request succeeded"
}
catch {
    Write-Error "Authenticated call failed: $_"
}

# 4. Authenticated Call (X-API-Key)
Write-Host "4. Checking Authenticated Access (X-API-Key)..."
try {
    $headers = @{ "x-api-key" = $apiKey }
    Invoke-RestMethod -Uri "$BaseUrl/mcp" -Method Post -Body (@{jsonrpc = "2.0"; method = "tools/list"; id = 1 } | ConvertTo-Json) -ContentType "application/json" -Headers $headers | Out-Null
    Write-Host "   Success: Request succeeded"
}
catch {
    Write-Error "Authenticated call failed: $_"
}

# 5. Revoke Key
Write-Host "5. Revoking Key..."
try {
    $headers = @{ Authorization = "Bearer $apiKey" }
    Invoke-RestMethod -Uri "$BaseUrl/api-keys/revoke" -Method Post -Headers $headers | Out-Null
    Write-Host "   Success: Key revoked"
}
catch {
    Write-Error "Revocation failed: $_"
}

# 6. Verify Revocation
Write-Host "6. Verifying Revocation..."
try {
    $headers = @{ Authorization = "Bearer $apiKey" }
    Invoke-RestMethod -Uri "$BaseUrl/mcp" -Method Post -Body (@{jsonrpc = "2.0"; method = "tools/list"; id = 1 } | ConvertTo-Json) -ContentType "application/json" -Headers $headers | Out-Null
    Write-Error "Should have failed with 401 after revocation"
}
catch {
    if ($_.Exception.Response.StatusCode -ne [System.Net.HttpStatusCode]::Unauthorized) {
        Write-Error "Expected 401, got $($_.Exception.Response.StatusCode)"
    }
    else {
        Write-Host "   Success: Got 401 (Revoked)"
    }
}

Write-Host "Done!"
