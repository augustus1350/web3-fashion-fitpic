# Prepares the repo for Render Blueprint deploy.
# Run from project root: .\scripts\deploy-render.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "=== Render deploy prep ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path "prisma\pglite-schema.sql")) {
    Write-Host "Generating prisma/pglite-schema.sql ..."
    npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script `
        | Out-File -Encoding utf8 prisma/pglite-schema.sql
}

Write-Host "Building ..."
npm run build

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Push this folder to GitHub (see commands below)"
Write-Host "2. https://render.com -> New -> Blueprint"
Write-Host "3. Connect repo, deploy fitpic-farcaster-poc"
Write-Host "4. After deploy (~3 min), open:"
Write-Host "   https://YOUR-SERVICE.onrender.com/health"
Write-Host "5. Warpcast Embed Tool:"
Write-Host "   https://YOUR-SERVICE.onrender.com"
Write-Host ""

if (-not (Test-Path ".git")) {
    Write-Host "Git not initialized in this folder. Example:" -ForegroundColor Yellow
    Write-Host @"
git init
git add .
git commit -m "Prepare FitPic PoC for Render deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USER/web3-fashion-fitpic.git
git push -u origin main
"@
}
