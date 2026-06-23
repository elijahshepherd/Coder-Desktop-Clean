Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$releasePath = Join-Path $repoRoot "release"
$package = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "package.json") | ConvertFrom-Json
$version = [string]$package.version
$rcedit = Join-Path $repoRoot "node_modules\electron-winstaller\vendor\rcedit.exe"

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

function Set-CoderDesktopMetadata {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Expected executable was not found: $Path"
  }

  & $rcedit $Path `
    --set-version-string FileDescription "Coder Desktop" `
    --set-version-string ProductName "Coder Desktop" `
    --set-version-string CompanyName "Elijah Shepherd" `
    --set-version-string OriginalFilename (Split-Path $Path -Leaf) `
    --set-file-version $version `
    --set-product-version $version `
    --set-icon (Join-Path $repoRoot "build\icon.ico")

  if ($LASTEXITCODE -ne 0) {
    throw "Could not stamp executable metadata: $Path"
  }
}

Invoke-Checked { npm run build }
Invoke-Checked { npm exec electron-builder -- --dir --config.win.signAndEditExecutable=false --publish never }

$appExe = Join-Path $releasePath "win-unpacked\Coder Desktop.exe"
Set-CoderDesktopMetadata -Path $appExe
