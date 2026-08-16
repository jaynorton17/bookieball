$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$launcher = Join-Path $repoRoot 'BookieBall App.cmd'

if (-not (Test-Path $launcher)) {
  throw "Launcher not found at $launcher"
}

# Use the custom BookieBall icon if available, otherwise fall back to generic
$iconPath = Join-Path $repoRoot 'web\public\favicon.ico'
if (-not (Test-Path $iconPath)) {
  $iconPath = "$env:SystemRoot\System32\shell32.dll,13"
}

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'BookieBall.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $repoRoot
$shortcut.Description = 'BookieBall — local gameshow league manager (runs at http://localhost:5180)'
$shortcut.IconLocation = $iconPath
$shortcut.Save()

Write-Host "Created desktop shortcut: $shortcutPath"
