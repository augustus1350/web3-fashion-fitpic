# Tests if your tunnel URL is reachable from outside (like Warpcast does).
# Usage: .\scripts\test-tunnel.ps1 https://your-url.loca.lt

param(
    [Parameter(Mandatory = $true)]
    [string]$Url
)

$base = $Url.TrimEnd("/")
$endpoints = @("$base/health", "$base/", "$base/frames/debug", "$base/frames")

$headers = @{
    # Localtunnel reminder page blocks browser-like clients without this header.
    "Bypass-Tunnel-Reminder" = "true"
}

function Test-Endpoint {
    param([string]$Endpoint)

    Write-Host "`n==> GET $Endpoint"
    $maxAttempts = 3
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Endpoint -UseBasicParsing -TimeoutSec 20 -Headers $headers
            Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
            if ($Endpoint -like "*/debug") {
                Write-Host $response.Content
            }
            return $true
        } catch {
            $msg = $_.Exception.Message
            if ($attempt -lt $maxAttempts) {
                Write-Host "Attempt $attempt failed ($msg), retrying..." -ForegroundColor Yellow
                Start-Sleep -Seconds 2
            } else {
                Write-Host "FAILED: $msg" -ForegroundColor Red
                return $false
            }
        }
    }
    return $false
}

Write-Host "Testing tunnel (with Bypass-Tunnel-Reminder header)..."
Write-Host "Tip: open $base in your browser once and click through the loca.lt reminder page."

$ok = 0
foreach ($endpoint in $endpoints) {
    if (Test-Endpoint -Endpoint $endpoint) { $ok++ }
}

Write-Host "`n$ok / $($endpoints.Count) endpoints OK."

Write-Host "`n==> Warpcast crawler simulation (no Bypass header)"
$warpcastOk = $false
try {
    $wc = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -TimeoutSec 25 -UserAgent "WarpcastBot/1.0"
    Write-Host "Status: $($wc.StatusCode)" -ForegroundColor Green
    if ($wc.Content -match 'name="fc:miniapp"') {
        Write-Host "fc:miniapp meta tag found - Warpcast can parse embed." -ForegroundColor Green
        $warpcastOk = $true
    } else {
        Write-Host "NO fc:miniapp in response - likely loca.lt reminder page." -ForegroundColor Red
    }
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Warpcast Embed Tool will show Preview unavailable." -ForegroundColor Red
}

if (-not $warpcastOk) {
    Write-Host "`nloca.lt blocks Warpcast crawlers. Use Cloudflare instead:" -ForegroundColor Yellow
    Write-Host "  npm run tunnel" -ForegroundColor Yellow
    Write-Host "Set APP_URL to the trycloudflare.com URL, restart dev:stable, open URL in browser once." -ForegroundColor Yellow
}
