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
$downloads = Join-Path $repoRoot "downloads\$version"
$release = Join-Path $repoRoot "release"

New-Item -ItemType Directory -Force -Path $downloads | Out-Null
Get-ChildItem -LiteralPath $downloads -File -ErrorAction SilentlyContinue |
  Where-Object {
    ($_.Name -like "Coder-Desktop-$version-win-*" -or $_.Name -like "Coder-Desktop-$version-setup-win-*") -and
    $_.Extension -in @(".exe", ".zip", ".dmg", ".msi", ".blockmap")
  } |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

Invoke-Checked { npm run build }
Invoke-Checked { powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\build-windows.ps1") -SkipBuild }

Get-ChildItem -LiteralPath $release -File |
  Where-Object {
    ($_.Name -like "Coder-Desktop-$version-win*" -or $_.Name -like "Coder-Desktop-$version-setup-win*") -and
    $_.Extension -in @(".exe", ".zip", ".blockmap")
  } |
  ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $downloads $_.Name) -Force
  }

Invoke-Checked { powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\build-windows.ps1") -Target nsis -SkipBuild }

Get-ChildItem -LiteralPath $release -File |
  Where-Object {
    ($_.Name -like "Coder-Desktop-$version-setup-win*" -or $_.Name -like "Coder-Desktop-$version-win-arm64.zip") -and
    $_.Extension -in @(".exe", ".zip", ".blockmap")
  } |
  ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $downloads $_.Name) -Force
  }

Invoke-Checked { powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\verify-windows-release.ps1") -Version $version }
Invoke-Checked { npm run release:manifest }

Write-Host "Release build finished. Artifacts were copied into downloads/$version."
