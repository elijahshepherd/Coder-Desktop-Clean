import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanupOldCoderDesktopDownloads,
  getCoderDesktopArtifactVersion,
  isOlderVersion
} from "./downloadCleanup";

describe("download cleanup", () => {
  it("detects Coder Desktop release artifact versions", () => {
    expect(getCoderDesktopArtifactVersion("Coder-Desktop-0.0.26-setup-win-x64.exe")).toBe("0.0.26");
    expect(getCoderDesktopArtifactVersion("Coder-Desktop-0.0.26-setup-win-x64.exe.blockmap")).toBe("0.0.26");
    expect(getCoderDesktopArtifactVersion("Coder-Desktop-0.0.26-win-x64.zip")).toBe("0.0.26");
    expect(getCoderDesktopArtifactVersion("Coder-Desktop-0.0.26-windows-trust-report.txt")).toBeNull();
    expect(getCoderDesktopArtifactVersion("Other-App-0.0.1-win-x64.exe")).toBeNull();
  });

  it("compares release versions without treating equal versions as old", () => {
    expect(isOlderVersion("0.0.26", "0.0.27")).toBe(true);
    expect(isOlderVersion("0.0.27", "0.0.27")).toBe(false);
    expect(isOlderVersion("0.0.28", "0.0.27")).toBe(false);
  });

  it("removes only old Coder Desktop downloads and app-owned staging folders", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "coder-desktop-cleanup-"));
    const downloadsDirectory = path.join(root, "Downloads");
    const tempDirectory = path.join(root, "Temp");
    const downloadsUpdateFolder = path.join(downloadsDirectory, "Coder Desktop updates");
    const tempUpdateFolder = path.join(tempDirectory, "coder-desktop-updates");

    await Promise.all([
      mkdir(downloadsDirectory, { recursive: true }),
      mkdir(downloadsUpdateFolder, { recursive: true }),
      mkdir(tempUpdateFolder, { recursive: true })
    ]);

    const oldInstaller = path.join(downloadsDirectory, "Coder-Desktop-0.0.26-setup-win-x64.exe");
    const oldZip = path.join(downloadsDirectory, "Coder-Desktop-0.0.25-win-x64.zip");
    const currentInstaller = path.join(downloadsDirectory, "Coder-Desktop-0.0.27-setup-win-x64.exe");
    const unrelated = path.join(downloadsDirectory, "Important-Setup.exe");
    const stagedDownload = path.join(downloadsUpdateFolder, "Coder-Desktop-0.0.26-setup-win-x64.exe");
    const stagedTemp = path.join(tempUpdateFolder, "Coder-Desktop-0.0.26-setup-win-x64.exe");

    await Promise.all([
      writeFile(oldInstaller, "old"),
      writeFile(oldZip, "old zip"),
      writeFile(currentInstaller, "current"),
      writeFile(unrelated, "unrelated"),
      writeFile(stagedDownload, "staged"),
      writeFile(stagedTemp, "staged temp")
    ]);

    const result = await cleanupOldCoderDesktopDownloads({
      currentVersion: "0.0.27",
      downloadsDirectory,
      tempDirectory
    });

    const remainingDownloads = await readdir(downloadsDirectory);
    const remainingTemp = await readdir(tempDirectory);

    expect(result.failures).toEqual([]);
    expect(result.deleted.some((item) => item.endsWith("Coder-Desktop-0.0.26-setup-win-x64.exe"))).toBe(true);
    expect(result.deleted.some((item) => item.endsWith("Coder Desktop updates"))).toBe(true);
    expect(result.deleted.some((item) => item.endsWith("coder-desktop-updates"))).toBe(true);
    expect(remainingDownloads).toContain("Coder-Desktop-0.0.27-setup-win-x64.exe");
    expect(remainingDownloads).toContain("Important-Setup.exe");
    expect(remainingDownloads).not.toContain("Coder-Desktop-0.0.26-setup-win-x64.exe");
    expect(remainingDownloads).not.toContain("Coder-Desktop-0.0.25-win-x64.zip");
    expect(remainingDownloads).not.toContain("Coder Desktop updates");
    expect(remainingTemp).not.toContain("coder-desktop-updates");
  });
});
