# Bot Detection Check
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:3010"

Write-Host "Testing /register with Bot User-Agent..."
$body = @{
    client_name   = "Bot Check"
    redirect_uris = @("http://localhost:3000/callback")
} | ConvertTo-Json

# Use a generic bot UA
$headers = @{
    "User-Agent" = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
}

try {
    # We are checking that we get JSON back, not HTML (which would indicate a Cloudflare challenge page)
    $response = Invoke-WebRequest -Uri "$baseUrl/register" -Method Post -Body $body -ContentType "application/json" -Headers $headers
    
    $contentType = $response.Headers["Content-Type"]
    if ($contentType -notmatch "application/json") {
        Write-Error "Expected JSON response, got $contentType. specific Cloudflare challenge likely."
    }
    
    Write-Host "   PASS: Received JSON response (no Cloudflare challenge)." -ForegroundColor Green
}
catch {
    # If it errors with 4xx/5xx that's fine as long as it's not a cloudflare HTML page blocking us
    # Check if the error response is JSON
    if ($_.Exception.Response) {
        $contentType = $_.Exception.Response.Headers["Content-Type"]
        if ($contentType -match "text/html") {
            Write-Warning "Received HTML error response. Could be Cloudflare block."
        }
        else {
            Write-Host "   PASS: Error response was not HTML (likely API error, which is fine for this check)." -ForegroundColor Green
        }
    }
    else {
        Write-Error "Request failed: $_"
    }
}
