$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$webUrl = 'http://localhost:5180'
$webPort = 5180
$apiPort = 5181

Set-Location $repoRoot

function Write-Step {
  param([string] $Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-PortOwner {
  param([int] $Port)

  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if (-not $connection) {
    return $null
  }

  $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue

  [pscustomobject]@{
    Port = $Port
    ProcessId = $connection.OwningProcess
    CommandLine = $processInfo.CommandLine
  }
}

function Test-BookieBallOwner {
  param($Owner)

  if (-not $Owner -or -not $Owner.CommandLine) {
    return $false
  }

  return $Owner.CommandLine -like '*bookieball*'
}

function Assert-PortAvailableOrBookieBall {
  param([int] $Port)

  $owner = Get-PortOwner -Port $Port
  if (-not $owner) {
    return $null
  }

  if (Test-BookieBallOwner -Owner $owner) {
    return $owner
  }

  throw "Port $Port is already in use by process $($owner.ProcessId). Close that app first, then run BookieBall again."
}

function Invoke-Checked {
  param(
    [string] $FilePath,
    [string[]] $Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

# Read version from package.json
$packageJson = Get-Content (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
$appVersion = $packageJson.version

Write-Host ""
Write-Host "  [BB] BookieBall v$appVersion  [BB]" -ForegroundColor Yellow
Write-Host "  Local gameshow league manager" -ForegroundColor Gray
Write-Host ""

$existingWeb = Assert-PortAvailableOrBookieBall -Port $webPort
$existingApi = Assert-PortAvailableOrBookieBall -Port $apiPort

if ($existingWeb -and $existingApi) {
  Write-Step "BookieBall is already running"
  Start-Process $webUrl
  exit 0
}

if ($existingWeb -or $existingApi) {
  throw "BookieBall looks partly open already. Close the old BookieBall launcher window, then run it again."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Install Node.js, then run this launcher again."
}

if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
  Write-Step "Installing dependencies"
  Invoke-Checked -FilePath 'npm' -Arguments @('install')
}

$webBuild = Join-Path $repoRoot 'dist-web\index.html'
$buildNeeded = -not (Test-Path $webBuild)

if (-not $buildNeeded) {
  $buildTime = (Get-Item $webBuild).LastWriteTimeUtc
  $sourceRoots = @(
    (Join-Path $repoRoot 'web\src'),
    (Join-Path $repoRoot 'web\index.html'),
    (Join-Path $repoRoot 'web\vite.config.ts')
  )
  $newestSource = Get-ChildItem $sourceRoots -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

  if ($newestSource -and $newestSource.LastWriteTimeUtc -gt $buildTime) {
    $buildNeeded = $true
  }
}

if ($buildNeeded) {
  Write-Step "Building web app (source files changed since last build)"
  Invoke-Checked -FilePath 'npm' -Arguments @('run', 'build:web')
  Write-Host "  [OK] Build complete" -ForegroundColor Green
}

$tsx = Join-Path $repoRoot 'node_modules\.bin\tsx.cmd'
if (-not (Test-Path $tsx)) {
  throw "tsx was not found in node_modules. Run npm install and try again."
}

Write-Step "Starting BookieBall v$appVersion"
Write-Host ""
Write-Host "  [Web] App  : $webUrl" -ForegroundColor Cyan
Write-Host "  [Dir] Repo : $repoRoot" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Keep this window open while you use the app." -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop BookieBall." -ForegroundColor Yellow
Write-Host ""

& $tsx 'src/cli.ts' 'start' '--prod'
