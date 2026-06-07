# Fixes corrupted PGlite (RuntimeError: Aborted).
# Usage: .\scripts\fix-db.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> Removing corrupted PGlite data..."
Remove-Item -Recurse -Force .dev-pglite-data -ErrorAction SilentlyContinue

Write-Host "==> Reseeding database..."
npm run db:seed

Write-Host ""
Write-Host "Done. Start the server with:"
Write-Host "  npm run dev:stable"
Write-Host ""
Write-Host "(Use dev:stable while testing Frames — avoids hot-reload DB crashes)"
