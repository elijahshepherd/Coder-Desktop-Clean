param(
  [string]$Version = "",
  [string]$DownloadsPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$package = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "package.json") | ConvertFrom-Json

if (-not $Version) {
  $Version = [string]$package.version
}

$downloads = if ($DownloadsPath) { $DownloadsPath } else { Join-Path $repoRoot "downloads\$Version" }
$requiredArtifacts = @(
  "Coder-Desktop-$Version-setup-win-x64.exe",
  "Coder-Desktop-$Version-win-x64.exe",
  "Coder-Desktop-$Version-win-x64.zip"
)

$optionalArtifacts = @(
  "Coder-Desktop-$Version-win-arm64.zip"
)

if (-not (Test-Path -LiteralPath $downloads)) {
  throw "Windows download folder does not exist: $downloads"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add("Coder Desktop Windows release trust report")
$reportLines.Add("")
$reportLines.Add("Version: $Version")
$reportLines.Add("Generated at: $((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ"))")
$reportLines.Add("Signing configured: $([bool]$env:CSC_LINK)")
$reportLines.Add("")
$reportLines.Add("Required artifacts")

foreach ($artifact in $requiredArtifacts) {
  $path = Join-Path $downloads $artifact

  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing required Windows artifact: $artifact"
  }

  $item = Get-Item -LiteralPath $path

  if ($item.Length -lt 10MB) {
    throw "Windows artifact is too small to be a real application download: $artifact"
  }

  $reportLines.Add("- $artifact ($($item.Length) bytes)")
}

  $optionalArtifacts = @(
    "Coder-Desktop-$Version-win-arm64.zip"
  )

  $reportLines.Add("")
  $reportLines.Add("Optional artifacts (arm64)")
  foreach ($artifact in $optionalArtifacts) {
    $path = Join-Path $downloads $artifact
    if (Test-Path -LiteralPath $path) {
      $item = Get-Item -LiteralPath $path
      if ($item.Length -lt 10MB) {
        throw "Windows artifact is too small to be a real application download: $artifact"
      }
      $reportLines.Add("- $artifact ($($item.Length) bytes) [optional, present]")
    } else {
      $reportLines.Add("- $artifact [optional, not built]")
    }
  }

  $reportLines.Add("")

  $reportLines.Add("Portable ZIP contents")
  foreach ($zipName in @("Coder-Desktop-$Version-win-x64.zip", "Coder-Desktop-$Version-win-arm64.zip")) {
    $zipPath = Join-Path $downloads $zipName
    if (-not (Test-Path -LiteralPath $zipPath)) {
      $reportLines.Add("- $zipName [not built]")
      continue
    }
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)

    try {
      $entries = $zip.Entries | ForEach-Object { $_.FullName }

      if ($entries -notcontains "Coder Desktop.exe") {
        throw "$zipName does not contain root-level Coder Desktop.exe."
      }

      if ($entries -notcontains "How to start Coder Desktop.txt") {
        throw "$zipName does not contain the portable start guide."
      }

      $reportLines.Add("- $zipName includes root-level Coder Desktop.exe and How to start Coder Desktop.txt.")
    } finally {
      $zip.Dispose()
    }
  }

$reportLines.Add("")
$reportLines.Add("Authenticode signatures")

function Get-AuthenticodeStatus {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  try {
    Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
    $signature = Microsoft.PowerShell.Security\Get-AuthenticodeSignature -LiteralPath $Path -ErrorAction Stop
    return [string]$signature.Status
  } catch {
    $message = $_.Exception.Message -replace "\s+", " "
    return "Unavailable ($message)"
  }
}

Get-ChildItem -LiteralPath $downloads -File |
  Where-Object { $_.Name -like "Coder-Desktop-$Version*win*.exe" } |
  Sort-Object Name |
  ForEach-Object {
    $reportLines.Add("- $($_.Name): $(Get-AuthenticodeStatus -Path $_.FullName)")
  }

$reportLines.Add("")
$reportLines.Add("Notes")
$reportLines.Add("- SmartScreen is reputation based. Code signing and stable official downloads are still required for the strongest Windows trust.")
$reportLines.Add("- Unsigned artifacts can still be valid builds, but they may show Windows safety prompts until a trusted signing and reputation path is used.")
$reportLines.Add("- The Windows ZIP backups keep one primary launch file at the ZIP root: Coder Desktop.exe.")

$reportPath = Join-Path $downloads "Coder-Desktop-$Version-windows-trust-report.txt"
Set-Content -LiteralPath $reportPath -Value $reportLines -Encoding UTF8
Write-Host "Windows release verification passed. Trust report written to downloads/$Version."
