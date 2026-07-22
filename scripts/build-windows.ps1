param(
  [ValidateSet("x64", "arm64")]
  [string[]]$Arch = @("x64", "arm64"),

  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$releasePath = Join-Path $repoRoot "release"
$package = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "package.json") | ConvertFrom-Json
$version = [string]$package.version

if (-not $env:CSC_LINK -and $env:WIN_CSC_LINK) {
  $env:CSC_LINK = $env:WIN_CSC_LINK
}

if (-not $env:CSC_KEY_PASSWORD -and $env:WIN_CSC_KEY_PASSWORD) {
  $env:CSC_KEY_PASSWORD = $env:WIN_CSC_KEY_PASSWORD
}

if ((Test-Path -LiteralPath $releasePath) -and ($releasePath.StartsWith($repoRoot.Path))) {
  Remove-Item -LiteralPath $releasePath -Recurse -Force
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

function Test-CodeSigningConfigured {
  return [bool]$env:CSC_LINK
}

function Get-WindowsBuilderSigningArgs {
  if (Test-CodeSigningConfigured) {
    Write-Host "Windows code signing configuration detected. Electron Builder signing remains enabled."
    return @()
  }

  Write-Host "Windows code signing configuration was not detected. Building unsigned artifacts with explicit metadata."
  return @("--config.win.signAndEditExecutable=false")
}

function Build-WindowsArch {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("x64", "arm64")]
    [string]$Arch
  )

  $unpacked = if ($Arch -eq "x64") {
    Join-Path $releasePath "win-unpacked"
  } else {
    Join-Path $releasePath "win-arm64-unpacked"
  }
  $setupExe = Join-Path $releasePath "Coder-Desktop-$version-setup-win-$Arch.exe"
  $zipPath = Join-Path $releasePath "Coder-Desktop-$version-win-$Arch.zip"
  [string[]]$signingArgs = @(Get-WindowsBuilderSigningArgs)

  Write-Host "Building Windows $Arch NSIS installer..."
  Invoke-Checked { npm exec electron-builder -- --win nsis:$Arch @signingArgs --publish never }

  if (-not (Test-Path -LiteralPath $setupExe)) {
    throw "Expected installer was not found: $setupExe"
  }

  $size = (Get-Item -LiteralPath $setupExe).Length
  if ($size -lt 10MB) {
    throw "Installer is too small to be a real application download: $setupExe ($size bytes)"
  }

  Write-Host "Creating distribution ZIP: $zipPath"
  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
  Compress-Archive -Path $setupExe -DestinationPath $zipPath -CompressionLevel Optimal

  $zipSize = (Get-Item -LiteralPath $zipPath).Length
  if ($zipSize -lt 10MB) {
    throw "Distribution ZIP is too small: $zipPath ($zipSize bytes)"
  }
}

if (-not $env:CSC_LINK) {
  $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
}

if (-not $SkipBuild) {
  Invoke-Checked { npm run build }
}

foreach ($a in $Arch) {
  $isArm64 = $a -eq "arm64"
  $isArmHost = $env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64"

  if ($isArm64 -and -not $isArmHost) {
    Write-Host "Skipping arm64 build (not running on ARM64 host)."
    continue
  }

  Build-WindowsArch -Arch $a
}

Write-Host "Windows build completed successfully."
