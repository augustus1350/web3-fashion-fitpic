# Exposes localhost:3000 via HTTPS (no ngrok install needed).
# Run in a SECOND terminal while `npm run dev` is running.
#
# Usage: .\scripts\tunnel.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "Starting Cloudflare tunnel to http://localhost:3000 ..."
Write-Host "Copy the https://....trycloudflare.com URL into .env as APP_URL"
Write-Host "Then restart: npm run dev"
Write-Host ""

npx cloudflared tunnel --url http://localhost:3000
