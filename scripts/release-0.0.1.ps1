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

$version = "0.0.1"
$downloads = Join-Path $PSScriptRoot "..\downloads\$version"
$release = Join-Path $PSScriptRoot "..\release"

New-Item -ItemType Directory -Force -Path $downloads | Out-Null
Get-ChildItem -LiteralPath $downloads -File |
  Where-Object { $_.Name -like "Coder-Desktop-$version-*" -and $_.Extension -in @(".exe", ".zip", ".dmg", ".msi", ".blockmap") } |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

Invoke-Checked { npm run release:windows }

Get-ChildItem -LiteralPath $release -File |
  Where-Object { $_.Name -like "Coder-Desktop-$version-win*" -and $_.Extension -in @(".exe", ".zip") } |
  ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $downloads $_.Name) -Force
}

Invoke-Checked { npm run release:manifest }

Write-Host "Release build finished. Artifacts were copied into downloads/$version."
