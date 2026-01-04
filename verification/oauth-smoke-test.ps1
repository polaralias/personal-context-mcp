# OAuth Smoke Test
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:3010"

Write-Host "1. Testing /.well-known/oauth-authorization-server..."
$metadata = Invoke-RestMethod -Uri "$baseUrl/.well-known/oauth-authorization-server" -Method Get
if ($metadata.issuer -notmatch "^https://") {
    Write-Error "Issuer must be proper https URL. Got: $($metadata.issuer)"
}
if ($metadata.authorization_endpoint -notmatch "^https://") {
    Write-Error "Authorization endpoint must be proper https URL. Got: $($metadata.authorization_endpoint)"
}
if ($metadata.token_endpoint -notmatch "^https://") {
    Write-Error "Token endpoint must be proper https URL. Got: $($metadata.token_endpoint)"
}
Write-Host "   PASS: Metadata endpoints are absolute HTTPS URLs." -ForegroundColor Green


Write-Host "`n2. Testing /register with ALLOWED redirect URI..."
$bodyAllowed = @{
    client_name   = "Smoke Test Client"
    redirect_uris = @("http://localhost:3000/callback")
} | ConvertTo-Json

try {
    $respAllowed = Invoke-RestMethod -Uri "$baseUrl/register" -Method Post -Body $bodyAllowed -ContentType "application/json"
    if (-not $respAllowed.client_id) {
        Write-Error "Response missing client_id"
    }
    Write-Host "   PASS: Registration succeeded for allowed URI." -ForegroundColor Green
}
catch {
    Write-Error "Failed to register allowed client: $_"
}


Write-Host "`n3. Testing /register with DISALLOWED redirect URI..."
$bodyDisallowed = @{
    client_name   = "Bad Client"
    redirect_uris = @("http://evil.com/callback")
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$baseUrl/register" -Method Post -Body $bodyDisallowed -ContentType "application/json"
    Write-Error "Should have failed with 400 Bad Request"
}
catch {
    $err = $_.Exception.Response
    if ($err.StatusCode -ne [System.Net.HttpStatusCode]::BadRequest) {
        Write-Error "Expected 400 Bad Request, got $($err.StatusCode)"
    }
    
    # Read stream to get JSON
    $stream = $err.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $json = $reader.ReadToEnd() | ConvertFrom-Json
    
    if ($json.error -ne "invalid_redirect_uri") {
        Write-Error "Expected error 'invalid_redirect_uri', got '$($json.error)'"
    }
    
    $expectedMsg = "This client isn't in the redirect allow list - raise an issue on GitHub for it to be added"
    if ($json.error_description -ne $expectedMsg) {
        Write-Error "Error description mismatch.`nExpected: '$expectedMsg'`nGot:      '$($json.error_description)'"
    }
    
    Write-Host "   PASS: Registration rejected with correct error message." -ForegroundColor Green
}
