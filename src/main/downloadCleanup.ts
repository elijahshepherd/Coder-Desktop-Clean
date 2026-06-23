import { readdir, rm } from "node:fs/promises";
import path from "node:path";

export interface DownloadCleanupOptions {
  currentVersion: string;
  downloadsDirectory: string;
  tempDirectory: string;
}

export interface DownloadCleanupResult {
  deleted: string[];
  failures: Array<{
    path: string;
    message: string;
  }>;
}

const coderDesktopArtifactPattern =
  /^Coder-Desktop-(\d+\.\d+\.\d+)-(?:setup-win-(?:x64|arm64)|win-(?:x64|arm64)|mac-(?:x64|arm64)|linux-(?:x64|arm64))(?:[.\w-]*)?\.(?:exe|zip|dmg|appimage|msi|blockmap)$/i;

const appOwnedStagingFolderNames = ["Coder Desktop updates", "coder-desktop-updates"];

export async function cleanupOldCoderDesktopDownloads({
  currentVersion,
  downloadsDirectory,
  tempDirectory
}: DownloadCleanupOptions): Promise<DownloadCleanupResult> {
  const result: DownloadCleanupResult = {
    deleted: [],
    failures: []
  };

  await removeAppOwnedStagingFolder(downloadsDirectory, "Coder Desktop updates", result);
  await removeAppOwnedStagingFolder(tempDirectory, "coder-desktop-updates", result);
  await removeOlderDirectDownloadArtifacts(downloadsDirectory, currentVersion, result);

  return result;
}

export function getCoderDesktopArtifactVersion(fileName: string): string | null {
  return coderDesktopArtifactPattern.exec(fileName)?.[1] ?? null;
}

export function isOlderVersion(candidateVersion: string, currentVersion: string): boolean {
  const candidate = parseVersionParts(candidateVersion);
  const current = parseVersionParts(currentVersion);
  const length = Math.max(candidate.length, current.length);

  for (let index = 0; index < length; index += 1) {
    const candidatePart = candidate[index] ?? 0;
    const currentPart = current[index] ?? 0;

    if (candidatePart < currentPart) {
      return true;
    }

    if (candidatePart > currentPart) {
      return false;
    }
  }

  return false;
}

async function removeOlderDirectDownloadArtifacts(
  downloadsDirectory: string,
  currentVersion: string,
  result: DownloadCleanupResult
): Promise<void> {
  const entries = await readDirectory(downloadsDirectory);

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const artifactVersion = getCoderDesktopArtifactVersion(entry.name);

    if (!artifactVersion || !isOlderVersion(artifactVersion, currentVersion)) {
      continue;
    }

    await removePath(path.join(downloadsDirectory, entry.name), result);
  }
}

async function removeAppOwnedStagingFolder(
  parentDirectory: string,
  folderName: string,
  result: DownloadCleanupResult
): Promise<void> {
  if (!appOwnedStagingFolderNames.includes(folderName)) {
    return;
  }

  const target = path.resolve(parentDirectory, folderName);
  const parent = path.resolve(parentDirectory);

  if (!isDirectChildPath(target, parent)) {
    return;
  }

  await removePath(target, result, true);
}

async function readDirectory(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function removePath(target: string, result: DownloadCleanupResult, recursive = false): Promise<void> {
  try {
    await rm(target, { force: true, recursive });
    result.deleted.push(target);
  } catch (error) {
    result.failures.push({
      path: target,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

function isDirectChildPath(target: string, parent: string): boolean {
  const relative = path.relative(parent, target);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function parseVersionParts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}
