param(
  [ValidateSet("portable", "nsis")]
  [string]$Target = "portable",

  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$releasePath = Join-Path $repoRoot "release"
$package = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "package.json") | ConvertFrom-Json
$version = [string]$package.version
$rcedit = Join-Path $repoRoot "node_modules\electron-winstaller\vendor\rcedit.exe"

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

function Set-CoderDesktopMetadata {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Expected executable was not found: $Path"
  }

  & $rcedit $Path `
    --set-version-string FileDescription "Coder Desktop - Local-first AI coding workspace" `
    --set-version-string ProductName "Coder Desktop" `
    --set-version-string CompanyName "Elijah Shepherd" `
    --set-version-string InternalName "Coder Desktop" `
    --set-version-string OriginalFilename (Split-Path $Path -Leaf) `
    --set-version-string LegalCopyright "Copyright (c) 2026 Elijah Shepherd" `
    --set-version-string LegalTrademarks "Coder Desktop is open source software" `
    --set-file-version $version `
    --set-product-version $version `
    --set-icon (Join-Path $repoRoot "build\icon.ico")

  if ($LASTEXITCODE -ne 0) {
    throw "Could not stamp executable metadata: $Path"
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

function Add-WindowsZipStartGuide {
  param(
    [Parameter(Mandatory = $true)]
    [string]$UnpackedPath,

    [Parameter(Mandatory = $true)]
    [ValidateSet("x64", "arm64")]
    [string]$Arch
  )

  $guidePath = Join-Path $UnpackedPath "How to start Coder Desktop.txt"
  $guide = @"
Coder Desktop portable ZIP

Start here:
1. Extract this ZIP first.
2. Open Coder Desktop.exe.
3. Keep Coder Desktop.exe in this folder with the resources folder and the other files.

This ZIP is the portable backup package for Windows $Arch. The official download source is:
https://github.com/elijahshepherd/Coder-Desktop/releases

If Windows shows a safety prompt, click "More info" then "Run anyway" to confirm the file came from the official Coder Desktop release at github.com/elijahshepherd/Coder-Desktop. SmartScreen is reputation based and new releases may trigger it until the file gains trust through use.
"@

  Set-Content -LiteralPath $guidePath -Value $guide -Encoding UTF8
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
  $appExe = Join-Path $unpacked "Coder Desktop.exe"
  $setupExe = Join-Path $releasePath "Coder-Desktop-$version-setup-win-$Arch.exe"
  $portableExe = Join-Path $releasePath "Coder-Desktop-$version-win-$Arch.exe"
  $zipPath = Join-Path $releasePath "Coder-Desktop-$version-win-$Arch.zip"
  [string[]]$signingArgs = @(Get-WindowsBuilderSigningArgs)

  if ($Arch -eq "x64") {
    if ($Target -eq "nsis") {
      Invoke-Checked { npm exec electron-builder -- --win nsis "--$Arch" @signingArgs --publish never }
    } else {
      Invoke-Checked { npm exec electron-builder -- --win portable "--$Arch" @signingArgs --publish never }
    }
  } else {
    Invoke-Checked { npm exec electron-builder -- --win dir "--$Arch" @signingArgs --publish never }
  }

  if (-not (Test-CodeSigningConfigured)) {
    Set-CoderDesktopMetadata -Path $appExe
  }

  if ($Arch -eq "x64" -and $Target -eq "nsis") {
    if (-not (Test-Path -LiteralPath $setupExe)) {
      throw "Expected installer was not found: $setupExe"
    }

    if ((Get-Item -LiteralPath $setupExe).Length -lt 10MB) {
      throw "Installer is too small to be a real application download: $setupExe"
    }
  }

  if ($Arch -eq "x64" -and $Target -eq "portable") {
    if (-not (Test-Path -LiteralPath $portableExe)) {
      throw "Expected portable executable was not found: $portableExe"
    }

    if ((Get-Item -LiteralPath $portableExe).Length -lt 10MB) {
      throw "Portable executable is too small to be a real application download: $portableExe"
    }
  }

  Add-WindowsZipStartGuide -UnpackedPath $unpacked -Arch $Arch
  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
  Compress-Archive -Path (Join-Path $unpacked "*") -DestinationPath $zipPath -CompressionLevel Optimal

  if ((Get-Item -LiteralPath $zipPath).Length -lt 10MB) {
    throw "Windows ZIP is too small to be a real application download: $zipPath"
  }
}

if (-not $env:CSC_LINK) {
  $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
}

if (-not $SkipBuild) {
  Invoke-Checked { npm run build }
}

Build-WindowsArch -Arch "x64"
Build-WindowsArch -Arch "arm64"
