import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { UpdateAsset, UpdateInfo, UpdateInstallResult, UpdateProgress } from "../shared/types";

interface GitHubReleaseAsset {
  name: string;
  size: number;
  updated_at?: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

interface UpdateServiceOptions {
  currentVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  tempDirectory: string;
  downloadsDirectory: string;
  portableExecutablePath: string | null;
  currentExecutablePath: string | null;
  processId: number;
  parentProcessId: number;
  currentExecutableMtimeMs?: number | null;
  fetchImpl?: typeof fetch;
  onRevealDownloadedFile: (filePath: string) => void;
  onOpenExternalUrl: (url: string) => Promise<void>;
  onQuitForInstall: () => void;
}

type ProgressListener = (progress: UpdateProgress) => void;

const latestReleaseUrl = "https://api.github.com/repos/elijahshepherd/Coder-Desktop/releases/latest";
const userAgent = "Coder Desktop updater";

export class UpdateService {
  private latestUpdate: UpdateInfo | null = null;

  constructor(private readonly options: UpdateServiceOptions) {}

  async checkForUpdate(): Promise<UpdateInfo | null> {
    const release = await this.fetchLatestRelease();
    const latestVersion = normalizeVersion(release.tag_name);
    const currentVersion = normalizeVersion(this.options.currentVersion);
    const asset = selectUpdateAsset(release.assets, this.options.platform, this.options.arch);

    if (!asset) {
      this.latestUpdate = null;
      return null;
    }

    const hasNewerVersion = isVersionNewer(latestVersion, currentVersion);

    if (!hasNewerVersion) {
      this.latestUpdate = null;
      return null;
    }

    this.latestUpdate = {
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      asset,
      canAutoInstall: false
    };

    return this.latestUpdate;
  }

  async installLatestUpdate(onProgress: ProgressListener): Promise<UpdateInstallResult> {
    const update = this.latestUpdate ?? (await this.checkForUpdate());

    if (!update) {
      throw new Error("Coder Desktop is already up to date.");
    }

    await this.options.onOpenExternalUrl(update.asset.downloadUrl);

    onProgress({
      phase: "ready",
      percent: 100,
      transferredBytes: update.asset.sizeBytes,
      totalBytes: update.asset.sizeBytes,
      message: "Opened the GitHub download."
    });

    return {
      status: "opened",
      message: "Opened the matching GitHub release download."
    };
  }

  private async fetchLatestRelease(): Promise<GitHubRelease> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(latestReleaseUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": userAgent
      }
    });

    if (!response.ok) {
      throw new Error(`Update check failed with status ${response.status}.`);
    }

    return (await response.json()) as GitHubRelease;
  }

  private async downloadUpdate(update: UpdateInfo, onProgress: ProgressListener): Promise<string> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const updateDirectory = update.canAutoInstall
      ? path.join(this.options.tempDirectory, "coder-desktop-updates")
      : path.join(this.options.downloadsDirectory, "Coder Desktop updates");
    const destination = path.join(updateDirectory, createUniqueDownloadName(update.asset.name));
    const partialDestination = `${destination}.download`;

    await mkdir(updateDirectory, { recursive: true });
    await rm(partialDestination, { force: true });

    onProgress({
      phase: "downloading",
      percent: 0,
      transferredBytes: 0,
      totalBytes: update.asset.sizeBytes,
      message: `Downloading ${update.latestVersion}.`
    });

    const response = await fetchImpl(update.asset.downloadUrl, {
      headers: {
        "User-Agent": userAgent
      }
    });

    if (!response.ok || !response.body) {
      throw new Error(`Update download failed with status ${response.status}.`);
    }

    const headerTotal = Number(response.headers.get("content-length"));
    const totalBytes = Number.isFinite(headerTotal) && headerTotal > 0 ? headerTotal : update.asset.sizeBytes;
    const writer = createWriteStream(partialDestination, { flags: "wx" });
    let transferredBytes = 0;

    try {
      const stream = Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>);

      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        transferredBytes += buffer.byteLength;

        if (!writer.write(buffer)) {
          await once(writer, "drain");
        }

        onProgress({
          phase: "downloading",
          percent: totalBytes ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : null,
          transferredBytes,
          totalBytes,
          message: `Downloading ${update.latestVersion}.`
        });
      }

      writer.end();
      await once(writer, "finish");
      await rename(partialDestination, destination);
      return destination;
    } catch (error) {
      writer.destroy();
      await rm(partialDestination, { force: true });
      throw error;
    }
  }

  private canReplacePortableExecutable(asset: UpdateAsset): boolean {
    return (
      this.options.platform === "win32" &&
      Boolean(this.options.portableExecutablePath) &&
      asset.format === "Windows portable executable"
    );
  }

  private canLaunchInstaller(asset: UpdateAsset): boolean {
    return this.options.platform === "win32" && asset.format === "Windows installer";
  }

  private async launchWindowsInstaller(downloadPath: string, expectedVersion: string): Promise<void> {
    const scriptPath = path.join(this.options.tempDirectory, `coder-desktop-installer-${Date.now()}.ps1`);
    const targetPath = this.options.currentExecutablePath ?? this.options.portableExecutablePath;
    const script = createWindowsInstallerScript({
      installerPath: downloadPath,
      scriptPath,
      processId: this.options.processId,
      targetPath,
      expectedVersion
    });

    await writeFile(scriptPath, script, "utf8");

    await launchDetachedPowerShell(scriptPath);
  }

  private async stageWindowsPortableReplacement(downloadPath: string, targetPath: string): Promise<void> {
    const scriptPath = path.join(this.options.tempDirectory, `coder-desktop-update-${Date.now()}.ps1`);
    const backupPath = `${targetPath}.old`;
    const processIds = [this.options.processId, this.options.parentProcessId]
      .filter((id) => Number.isInteger(id) && id > 0)
      .join(", ");

    const script = [
      "$ErrorActionPreference = 'Stop'",
      `$source = ${toPowerShellString(downloadPath)}`,
      `$target = ${toPowerShellString(targetPath)}`,
      `$backup = ${toPowerShellString(backupPath)}`,
      `$scriptPath = ${toPowerShellString(scriptPath)}`,
      `$processIds = @(${processIds})`,
      "function Invoke-WithRetry {",
      "  param([scriptblock]$Action)",
      "  $lastError = $null",
      "  for ($attempt = 1; $attempt -le 30; $attempt++) {",
      "    try {",
      "      & $Action",
      "      return",
      "    } catch {",
      "      $lastError = $_",
      "      Start-Sleep -Milliseconds 500",
      "    }",
      "  }",
      "  throw $lastError",
      "}",
      "foreach ($id in $processIds) {",
      "  try { Wait-Process -Id $id -Timeout 90 -ErrorAction SilentlyContinue } catch {}",
      "}",
      "Start-Sleep -Milliseconds 700",
      "Invoke-WithRetry { if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue } }",
      "Invoke-WithRetry { if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $backup -Force } }",
      "Invoke-WithRetry { Move-Item -LiteralPath $source -Destination $target -Force }",
      "Invoke-WithRetry { if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue } }",
      "Start-Process -FilePath $target",
      "Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue"
    ].join("\n");

    await writeFile(scriptPath, script, "utf8");

    await launchDetachedPowerShell(scriptPath);
  }
}

interface WindowsInstallerScriptOptions {
  installerPath: string;
  scriptPath: string;
  processId: number;
  targetPath: string | null;
  expectedVersion: string;
}

export function createWindowsInstallerScript({
  installerPath,
  scriptPath,
  processId,
  targetPath,
  expectedVersion
}: WindowsInstallerScriptOptions): string {
  const processIds = [processId].filter((id) => Number.isInteger(id) && id > 0).join(", ");
  const relaunchCandidates = createWindowsInstallerRelaunchCandidates(targetPath);

  return [
    "$ErrorActionPreference = 'Stop'",
    `$installer = ${toPowerShellString(installerPath)}`,
    `$scriptPath = ${toPowerShellString(scriptPath)}`,
    `$processIds = @(${processIds})`,
    `$relaunchCandidates = @(${relaunchCandidates.map(toPowerShellString).join(", ")})`,
    `$expectedVersion = ${toPowerShellString(normalizeVersion(expectedVersion))}`,
    "$logPath = Join-Path $env:TEMP 'coder-desktop-update.log'",
    "function Write-UpdateLog {",
    "  param([string]$Message)",
    "  try { Add-Content -LiteralPath $logPath -Value \"$(Get-Date -Format o) $Message\" -ErrorAction SilentlyContinue } catch {}",
    "}",
    "function Get-CoderDesktopProcesses {",
    "  try {",
    "    return @(Get-CimInstance Win32_Process -Filter \"Name = 'Coder Desktop.exe'\" -ErrorAction SilentlyContinue)",
    "  } catch {",
    "    Write-UpdateLog \"Process scan failed: $($_.Exception.Message)\"",
    "    return @()",
    "  }",
    "}",
    "function Wait-CoderDesktopClosed {",
    "  foreach ($id in $processIds) {",
    "    try { Wait-Process -Id $id -Timeout 30 -ErrorAction SilentlyContinue } catch { Write-UpdateLog \"Wait failed for process $($id): $($_.Exception.Message)\" }",
    "  }",
    "  $deadline = (Get-Date).AddSeconds(30)",
    "  while ((Get-Date) -lt $deadline) {",
    "    $running = @(Get-CoderDesktopProcesses)",
    "    if ($running.Count -eq 0) { return $true }",
    "    Start-Sleep -Milliseconds 500",
    "  }",
    "  foreach ($process in @(Get-CoderDesktopProcesses)) {",
    "    try {",
    "      Write-UpdateLog \"Stopping remaining Coder Desktop process $($process.ProcessId).\"",
    "      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue",
    "    } catch {",
    "      Write-UpdateLog \"Could not stop process $($process.ProcessId): $($_.Exception.Message)\"",
    "    }",
    "  }",
    "  Start-Sleep -Milliseconds 800",
    "  return (@(Get-CoderDesktopProcesses).Count -eq 0)",
    "}",
    "function Get-CandidateVersion {",
    "  param([string]$Candidate)",
    "  if (-not $Candidate -or -not (Test-Path -LiteralPath $Candidate)) { return $null }",
    "  try {",
    "    $item = Get-Item -LiteralPath $Candidate -ErrorAction Stop",
    "    $version = [string]$item.VersionInfo.ProductVersion",
    "    if (-not $version) { $version = [string]$item.VersionInfo.FileVersion }",
    "    if ($version) { return $version.Trim() }",
    "  } catch {",
    "    Write-UpdateLog \"Version check failed for $Candidate: $($_.Exception.Message)\"",
    "  }",
    "  return $null",
    "}",
    "function Get-MatchingCoderDesktopPath {",
    "  foreach ($candidate in $relaunchCandidates) {",
    "    if (-not $candidate -or -not (Test-Path -LiteralPath $candidate)) { continue }",
    "    if (-not $expectedVersion) { return $candidate }",
    "    $version = Get-CandidateVersion -Candidate $candidate",
    "    if ($version -and $version.StartsWith($expectedVersion)) { return $candidate }",
    "    if ($version) {",
    "      Write-UpdateLog \"Version check saw '$version' at $candidate, expected $expectedVersion.\"",
    "    }",
    "  }",
    "  return $null",
    "}",
    "function Start-CoderDesktop {",
    "  $candidate = Get-MatchingCoderDesktopPath",
    "  if ($candidate) {",
    "    Write-UpdateLog \"Starting $candidate\"",
    "    Start-Process -FilePath $candidate",
    "    return $true",
    "  }",
    "  return $false",
    "}",
    "function Test-InstalledVersion {",
    "  return [bool](Get-MatchingCoderDesktopPath)",
    "}",
    "function Remove-UpdateDownloadArtifacts {",
    "  try {",
    "    if ($installer -and (Test-Path -LiteralPath $installer)) {",
    "      Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue",
    "    }",
    "  } catch { Write-UpdateLog \"Could not remove installer artifact: $($_.Exception.Message)\" }",
    "  try {",
    "    $updateFolder = Join-Path $env:TEMP 'coder-desktop-updates'",
    "    if (Test-Path -LiteralPath $updateFolder) {",
    "      Remove-Item -LiteralPath $updateFolder -Recurse -Force -ErrorAction SilentlyContinue",
    "    }",
    "  } catch { Write-UpdateLog \"Could not remove staged update folder: $($_.Exception.Message)\" }",
    "}",
    "try {",
    "  Write-UpdateLog 'Waiting for Coder Desktop to close.'",
    "  $closed = Wait-CoderDesktopClosed",
    "  if (-not $closed) { Write-UpdateLog 'Proceeding after forcing remaining Coder Desktop processes.' }",
    "  if (-not (Test-Path -LiteralPath $installer)) { throw \"Installer file was not found: $installer\" }",
    "  Write-UpdateLog 'Starting silent installer.'",
    "  $installerProcess = Start-Process -FilePath $installer -ArgumentList '/S' -Wait -PassThru",
    "  Write-UpdateLog \"Silent installer exited with code $($installerProcess.ExitCode).\"",
    "  if (-not (Test-InstalledVersion)) {",
    "    Write-UpdateLog 'Silent installer did not produce the expected version. Opening installer visibly as fallback.'",
    "    Start-Process -FilePath $installer -Wait",
    "  }",
    "  for ($attempt = 1; $attempt -le 40; $attempt++) {",
    "    if ((Test-InstalledVersion) -and (Start-CoderDesktop)) {",
    "      Remove-UpdateDownloadArtifacts",
    "      Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue",
    "      exit 0",
    "    }",
    "    Start-Sleep -Milliseconds 500",
    "  }",
    "  Write-UpdateLog 'Could not confirm the installed version or relaunch Coder Desktop.'",
    "  Start-Process -FilePath $installer",
    "} catch {",
    "  Write-UpdateLog \"Installer helper failed: $($_.Exception.Message)\"",
    "  try { Start-Process -FilePath $installer } catch {}",
    "} finally {",
    "  Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue",
    "}"
  ].join("\n");
}

export function createWindowsInstallerRelaunchCandidates(targetPath: string | null): string[] {
  const candidates = [targetPath].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));

  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, "Programs", "Coder Desktop", "Coder Desktop.exe"));
    candidates.push(path.join(process.env.LOCALAPPDATA, "Programs", "coder-desktop", "Coder Desktop.exe"));
  }

  if (process.env.ProgramFiles) {
    candidates.push(path.join(process.env.ProgramFiles, "Coder Desktop", "Coder Desktop.exe"));
  }

  const programFilesX86 = process.env["ProgramFiles(x86)"];

  if (programFilesX86) {
    candidates.push(path.join(programFilesX86, "Coder Desktop", "Coder Desktop.exe"));
  }

  return Array.from(new Set(candidates));
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function isVersionNewer(latestVersion: string, currentVersion: string): boolean {
  const latest = parseVersionParts(latestVersion);
  const current = parseVersionParts(currentVersion);
  const length = Math.max(latest.length, current.length);

  for (let index = 0; index < length; index += 1) {
    const latestPart = latest[index] ?? 0;
    const currentPart = current[index] ?? 0;

    if (latestPart > currentPart) {
      return true;
    }

    if (latestPart < currentPart) {
      return false;
    }
  }

  return false;
}

export function selectUpdateAsset(
  assets: GitHubReleaseAsset[],
  platform: NodeJS.Platform,
  arch: string
): UpdateAsset | null {
  const normalizedArch = normalizeArch(arch);
  const candidates = getAssetCandidates(platform, normalizedArch);

  for (const candidate of candidates) {
    const asset = assets.find((item) => {
      const name = item.name.toLowerCase();
      return (
        candidate.matches.every((fragment) => name.includes(fragment)) &&
        candidate.excludes.every((fragment) => !name.includes(fragment)) &&
        name.endsWith(candidate.extension)
      );
    });

    if (asset) {
      return {
        name: asset.name,
        downloadUrl: asset.browser_download_url,
        sizeBytes: asset.size,
        platform: candidate.platform,
        arch: normalizedArch,
        format: candidate.format,
        updatedAt: asset.updated_at
      };
    }
  }

  return null;
}

export function createUniqueDownloadName(assetName: string, nonce = randomUUID()): string {
  const extension = path.extname(assetName);
  const baseName = extension ? assetName.slice(0, -extension.length) : assetName;
  const safeNonce = nonce.replace(/[^a-z0-9-]/gi, "").slice(0, 36) || Date.now().toString(36);

  return `${baseName}-${safeNonce}${extension}`;
}

function getAssetCandidates(platform: NodeJS.Platform, arch: string) {
  if (platform === "win32") {
    return [
      {
        matches: [`setup-win-${arch}`],
        excludes: [],
        extension: ".exe",
        platform: "Windows",
        format: "Windows installer"
      },
      {
        matches: [`win-${arch}`],
        excludes: ["setup"],
        extension: ".exe",
        platform: "Windows",
        format: "Windows portable executable"
      },
      {
        matches: [`win-${arch}`],
        excludes: [],
        extension: ".zip",
        platform: "Windows",
        format: "Windows ZIP archive"
      }
    ];
  }

  if (platform === "darwin") {
    return [
      {
        matches: [`mac-${arch}`],
        excludes: [],
        extension: ".zip",
        platform: "macOS",
        format: "macOS ZIP archive"
      },
      {
        matches: [`mac-${arch}`],
        excludes: [],
        extension: ".dmg",
        platform: "macOS",
        format: "macOS disk image"
      }
    ];
  }

  if (platform === "linux") {
    return [
      {
        matches: [`linux-${arch}`],
        excludes: [],
        extension: ".appimage",
        platform: "Linux",
        format: "Linux AppImage"
      },
      {
        matches: [`linux-${arch}`],
        excludes: [],
        extension: ".zip",
        platform: "Linux",
        format: "Linux ZIP archive"
      }
    ];
  }

  return [];
}

function normalizeArch(arch: string): string {
  if (arch === "x64" || arch === "arm64") {
    return arch;
  }

  if (arch === "arm") {
    return "arm64";
  }

  return "x64";
}

function parseVersionParts(version: string): number[] {
  return normalizeVersion(version)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

function toPowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function verifyDownloadedUpdate(downloadPath: string, expectedSizeBytes: number): Promise<void> {
  const metadata = await stat(downloadPath);

  if (!metadata.isFile() || metadata.size <= 0) {
    throw new Error("The update download did not finish correctly.");
  }

  if (expectedSizeBytes > 0 && metadata.size < Math.floor(expectedSizeBytes * 0.95)) {
    throw new Error("The update download is incomplete.");
  }
}

async function launchDetachedPowerShell(scriptPath: string): Promise<void> {
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  await waitForChildSpawn(child);
  child.unref();
}

function waitForChildSpawn(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The update helper did not start."));
    }, 5_000);
    const cleanup = () => {
      clearTimeout(timer);
      child.removeListener("spawn", handleSpawn);
      child.removeListener("error", handleError);
    };
    const handleSpawn = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    child.once("spawn", handleSpawn);
    child.once("error", handleError);
  });
}
