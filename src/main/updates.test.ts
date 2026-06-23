import { describe, expect, it, vi } from "vitest";
import {
  UpdateService,
  createUniqueDownloadName,
  createWindowsInstallerRelaunchCandidates,
  createWindowsInstallerScript,
  isVersionNewer,
  normalizeVersion,
  selectUpdateAsset
} from "./updates";

const releaseAssets = [
  {
    name: "Coder-Desktop-0.0.4-setup-win-x64.exe",
    size: 80,
    updated_at: "2026-06-03T10:00:00.000Z",
    browser_download_url: "https://example.test/setup.exe"
  },
  {
    name: "Coder-Desktop-0.0.4-win-x64.exe",
    size: 100,
    browser_download_url: "https://example.test/win-x64.exe"
  },
  {
    name: "Coder-Desktop-0.0.4-win-arm64.exe",
    size: 95,
    browser_download_url: "https://example.test/win-arm64.exe"
  },
  {
    name: "Coder-Desktop-0.0.4-mac-arm64.zip",
    size: 120,
    browser_download_url: "https://example.test/mac-arm64.zip"
  },
  {
    name: "Coder-Desktop-0.0.4-linux-x64.AppImage",
    size: 140,
    browser_download_url: "https://example.test/linux-x64.AppImage"
  }
];

describe("update helpers", () => {
  it("normalizes release tags", () => {
    expect(normalizeVersion("v0.0.4")).toBe("0.0.4");
    expect(normalizeVersion("  V1.2.3  ")).toBe("1.2.3");
  });

  it("detects newer semantic versions", () => {
    expect(isVersionNewer("0.0.4", "0.0.3")).toBe(true);
    expect(isVersionNewer("0.1.0", "0.0.9")).toBe(true);
    expect(isVersionNewer("0.0.20", "0.0.19")).toBe(true);
    expect(isVersionNewer("v0.0.9", "0.0.9")).toBe(false);
    expect(isVersionNewer("0.0.9", "v0.0.9")).toBe(false);
    expect(isVersionNewer("0.0.9", "0.0.9.0")).toBe(false);
    expect(isVersionNewer("0.0.3", "0.0.3")).toBe(false);
    expect(isVersionNewer("0.0.2", "0.0.3")).toBe(false);
  });

  it("selects the Windows installer before portable executables", () => {
    const asset = selectUpdateAsset(releaseAssets, "win32", "x64");

    expect(asset?.name).toBe("Coder-Desktop-0.0.4-setup-win-x64.exe");
    expect(asset?.format).toBe("Windows installer");
    expect(asset?.updatedAt).toBe("2026-06-03T10:00:00.000Z");
  });

  it("selects architecture-specific macOS and Linux assets", () => {
    expect(selectUpdateAsset(releaseAssets, "darwin", "arm64")?.name).toBe("Coder-Desktop-0.0.4-mac-arm64.zip");
    expect(selectUpdateAsset(releaseAssets, "linux", "x64")?.name).toBe("Coder-Desktop-0.0.4-linux-x64.AppImage");
  });

  it("returns null when a platform has no compatible asset", () => {
    expect(selectUpdateAsset(releaseAssets, "darwin", "x64")).toBeNull();
  });

  it("creates unique staged download names without deleting a previous asset path", () => {
    expect(createUniqueDownloadName("Coder-Desktop-0.0.14-win-x64.exe", "abc-123")).toBe(
      "Coder-Desktop-0.0.14-win-x64-abc-123.exe"
    );
    expect(createUniqueDownloadName("Coder-Desktop-0.0.14-setup-win-x64.exe", "$$$")).toMatch(
      /^Coder-Desktop-0\.0\.14-setup-win-x64-[a-z0-9]+\.exe$/i
    );
  });

  it("creates installer relaunch scripts that only wait for the app process", () => {
    const script = createWindowsInstallerScript({
      installerPath: "C:\\Temp\\Coder-Desktop-0.0.16-setup-win-x64.exe",
      scriptPath: "C:\\Temp\\coder-desktop-installer.ps1",
      processId: 1234,
      targetPath: "C:\\Users\\Elijah\\AppData\\Local\\Programs\\Coder Desktop\\Coder Desktop.exe",
      expectedVersion: "0.0.16"
    });

    expect(script).toContain("$processIds = @(1234)");
    expect(script).not.toContain("explorer");
    expect(script).toContain("$expectedVersion = '0.0.16'");
    expect(script).toContain("Get-CimInstance Win32_Process -Filter \"Name = 'Coder Desktop.exe'\"");
    expect(script).toContain("Stop-Process -Id $process.ProcessId -Force");
    expect(script).toContain("Start-Process -FilePath $installer -ArgumentList '/S' -Wait -PassThru");
    expect(script).toContain("Get-MatchingCoderDesktopPath");
    expect(script).toContain("Test-InstalledVersion");
    expect(script).toContain("Silent installer did not produce the expected version.");
    expect(script).toContain("Start-CoderDesktop");
    expect(script).toContain("$candidate = Get-MatchingCoderDesktopPath");
    expect(script).toContain("Could not confirm the installed version or relaunch Coder Desktop.");
  });

  it("creates fallback relaunch paths for Windows installers", () => {
    const candidates = createWindowsInstallerRelaunchCandidates("C:\\Existing\\Coder Desktop.exe");

    expect(candidates[0]).toBe("C:\\Existing\\Coder Desktop.exe");
    expect(candidates.some((candidate) => candidate.endsWith("Coder Desktop.exe"))).toBe(true);
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it("opens the matching release asset instead of installing directly", async () => {
    const openExternalUrl = vi.fn<() => Promise<void>>().mockResolvedValue();
    const progress = vi.fn();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: "v0.0.4",
        html_url: "https://github.com/elijahshepherd/Coder-Desktop/releases/tag/v0.0.4",
        assets: releaseAssets
      })
    })) as unknown as typeof fetch;
    const service = new UpdateService({
      currentVersion: "0.0.3",
      platform: "win32",
      arch: "x64",
      tempDirectory: "C:\\Temp",
      downloadsDirectory: "C:\\Users\\Elijah\\Downloads",
      portableExecutablePath: null,
      currentExecutablePath: "C:\\Program Files\\Coder Desktop\\Coder Desktop.exe",
      processId: 1234,
      parentProcessId: 4321,
      fetchImpl,
      onRevealDownloadedFile: vi.fn(),
      onOpenExternalUrl: openExternalUrl,
      onQuitForInstall: vi.fn()
    });

    const update = await service.checkForUpdate();
    const result = await service.installLatestUpdate(progress);

    expect(update?.canAutoInstall).toBe(false);
    expect(openExternalUrl).toHaveBeenCalledWith("https://example.test/setup.exe");
    expect(result).toEqual({
      status: "opened",
      message: "Opened the matching GitHub release download."
    });
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "ready",
        percent: 100,
        message: "Opened the GitHub download."
      })
    );
  });
});
