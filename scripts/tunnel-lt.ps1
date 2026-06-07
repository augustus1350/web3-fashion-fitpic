# HTTPS tunnel via localtunnel (alternative to Cloudflare).

# Run in a SECOND terminal while `npm run dev:stable` is running.

#

# Usage: .\scripts\tunnel-lt.ps1



$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot\..



Write-Host ""

Write-Host "Starting localtunnel to http://127.0.0.1:3000 ..."

Write-Host "Copy the https://....loca.lt URL into .env as APP_URL"

Write-Host "Open that URL in your browser once and accept the reminder page."

Write-Host "Then restart: npm run dev:stable"

Write-Host ""



npx localtunnel --port 3000 --local-host 127.0.0.1


