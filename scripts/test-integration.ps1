# Run integration tests on Windows PowerShell.
# Usage:
#   .\scripts\test-integration.ps1              # PGlite (default)
#   .\scripts\test-integration.ps1 -Postgres    # prefer Docker Postgres

param(
    [switch]$Postgres,
    [switch]$Strict
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if ($Postgres) {
    $env:FORCE_TEST_POSTGRES = "1"
    $env:TEST_DATABASE_URL = "postgresql://test:test@localhost:5433/web3_fashion_test?schema=public"
}

if ($Strict) {
    $env:STRICT_TEST_POSTGRES = "1"
}

if ($Postgres) {
    Write-Host "Starting test PostgreSQL via Docker..."
    docker compose -f docker-compose.test.yml up -d --wait
}

npm run test:integration
