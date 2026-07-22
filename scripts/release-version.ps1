Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
trap {
  Write-Error $_
  exit 1
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$package = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "package.json") | ConvertFrom-Json
$version = [string]$package.version
$versionPrefix = "v$version"
$downloadsRoot = Join-Path $repoRoot "downloads"
$downloadsVersion = Join-Path $downloadsRoot $versionPrefix
$windowsFolder = Join-Path $downloadsVersion "Windows"
$macosFolder = Join-Path $downloadsVersion "macOS"
$release = Join-Path $repoRoot "release"

New-Item -ItemType Directory -Force -Path $windowsFolder | Out-Null
New-Item -ItemType Directory -Force -Path $macosFolder | Out-Null
Get-ChildItem -LiteralPath $windowsFolder -File -ErrorAction SilentlyContinue |
  Where-Object {
    ($_.Name -like "Coder-Desktop-$version-win-*" -or $_.Name -like "Coder-Desktop-$version-setup-win-*") -and
    $_.Extension -in @(".exe", ".zip", ".dmg", ".msi", ".blockmap")
  } |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

Invoke-Checked { npm run build }
Invoke-Checked { powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\build-windows.ps1") -SkipBuild }

Get-ChildItem -LiteralPath $release -File |
  Where-Object {
    ($_.Name -like "Coder-Desktop-$version-setup-win*" -or $_.Name -like "Coder-Desktop-$version-win-*.zip") -and
    $_.Extension -in @(".exe", ".zip", ".blockmap")
  } |
  ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $windowsFolder $_.Name) -Force
  }

Invoke-Checked { powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\verify-windows-release.ps1") -Version $version -DownloadsPath $windowsFolder }
Invoke-Checked { npm run release:manifest }

Write-Host "Release build finished. Artifacts were copied into downloads/$versionPrefix/Windows/."
