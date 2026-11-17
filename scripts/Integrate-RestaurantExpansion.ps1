[CmdletBinding()]
param(
    [string]$Checkout = (Join-Path $env:USERPROFILE 'seatplan-rux'),
    [string]$Bundle = (Join-Path $env:USERPROFILE 'Documents\ChatGPT\Tese\SeatPlan_Expansao.bundle'),
    [string]$Python = (Join-Path $env:USERPROFILE 'seatplan\.venv\Scripts\python.exe')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-CommandSucceeded([string]$Step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed (exit $LASTEXITCODE). Stopped without discarding local changes."
    }
}

foreach ($requiredPath in @($Checkout, $Bundle, $Python)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required path does not exist: $requiredPath"
    }
}

$checkoutPath = (Resolve-Path -LiteralPath $Checkout).Path.TrimEnd('\', '/')
$bundlePath = (Resolve-Path -LiteralPath $Bundle).Path
$pythonPath = (Resolve-Path -LiteralPath $Python).Path
$previousDirectory = Get-Location
$previousDatabaseUrl = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')

try {
    Set-Location -LiteralPath $checkoutPath
    $gitRoot = (& git rev-parse --show-toplevel).Trim().Replace('/', '\').TrimEnd('\')
    Assert-CommandSucceeded 'Checking repository'
    if (-not [string]::Equals($gitRoot, $checkoutPath.Replace('/', '\'), [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Checkout must name the repository root.'
    }
    $branch = (& git branch --show-current).Trim()
    Assert-CommandSucceeded 'Checking branch'
    if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq 'main') {
        throw 'Switch to your restaurant working branch before integrating.'
    }
    $changes = @(& git status --porcelain --untracked-files=normal)
    Assert-CommandSucceeded 'Checking local changes'
    if ($changes.Count -gt 0) {
        throw 'There are local changes. Commit or preserve them before running this script again; nothing was overwritten.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $checkoutPath 'frontend\node_modules\.bin\tsc.cmd'))) {
        throw 'Frontend dependencies are missing. Run npm ci in the frontend folder, then run this script again.'
    }
    & git bundle verify $bundlePath
    Assert-CommandSucceeded 'Verifying bundle'

    # This script integrates the local development app, never a remote database.
    $databasePath = Join-Path $checkoutPath 'backend\seatplan.db'
    $localDatabaseUrl = 'sqlite:///' + $databasePath.Replace('\', '/')
    if ($previousDatabaseUrl -and $previousDatabaseUrl -ne $localDatabaseUrl) {
        throw 'DATABASE_URL overrides the local development database. Use a terminal without that override to integrate the local app.'
    }
    if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
        throw 'The existing local seatplan.db was not found. Stopped to avoid starting an empty database.'
    }
    $backupDirectory = Join-Path (Split-Path -Parent $bundlePath) 'seatplan-backups'
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    $backupPath = Join-Path $backupDirectory ('seatplan-before-expansion-' + [Guid]::NewGuid().ToString('N') + '.db')
    $backupCode = @'
import pathlib, sqlite3, sys
source = sqlite3.connect(pathlib.Path(sys.argv[1]).resolve().as_uri() + '?mode=ro', uri=True, timeout=10)
destination = sqlite3.connect(sys.argv[2])
try:
    source.backup(destination)
finally:
    destination.close()
    source.close()
'@
    & $pythonPath -c $backupCode $databasePath $backupPath
    Assert-CommandSucceeded 'Backing up local database'
    Write-Host "Database backup: $backupPath"

    & git fetch --no-tags $bundlePath refs/heads/codex/finish-restaurants
    Assert-CommandSucceeded 'Importing commits'
    & git merge --ff-only --no-edit FETCH_HEAD
    Assert-CommandSucceeded 'Integrating commits'

    $env:DATABASE_URL = $localDatabaseUrl
    Set-Location -LiteralPath (Join-Path $checkoutPath 'backend')
    & $pythonPath -m app.seed.migrate
    Assert-CommandSucceeded 'Migrating local database'

    Set-Location -LiteralPath (Join-Path $checkoutPath 'frontend')
    & npm.cmd run build
    Assert-CommandSucceeded 'Building frontend'

    Write-Host 'Integration and migrations completed. Restart the backend if it does not use --reload, then refresh the browser.'
    Write-Host 'WhatsApp, SMS and payments remain deferred. No GitHub push was made by this script.'
} finally {
    [Environment]::SetEnvironmentVariable('DATABASE_URL', $previousDatabaseUrl, 'Process')
    Set-Location -LiteralPath $previousDirectory.Path
}
