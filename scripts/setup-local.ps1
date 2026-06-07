# One-time / repeat local setup for Windows PowerShell.
# Run from project root:  .\scripts\setup-local.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> Installing dependencies..."
npm install

Write-Host "==> Generating Prisma client..."
npx prisma generate

if (-not (Test-Path ".env")) {
    Write-Host "==> Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"
}

Write-Host "==> Seeding database (PGlite if no Postgres)..."
npm run db:seed

Write-Host ""
Write-Host "Done! Start the API with:"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Then open: http://localhost:3000/health"
