import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const version = packageJson.version;
const versionPrefix = `v${version}`;
const downloadDir = join("downloads", versionPrefix);
const platforms = ["Windows", "macOS", "Linux"];
const manifestPath = join(downloadDir, "manifest.json");
const existingManifest = await readExistingManifest(manifestPath);
const existingArtifacts = new Map((existingManifest?.artifacts ?? []).map((artifact) => [artifact.name, artifact]));

const artifactPattern = /^Coder-Desktop-(\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?)-(win|mac|linux)-(x64|arm64)(\.exe|\.zip|\.dmg|\.AppImage|\.msi|\.blockmap)$/;

const artifacts = [];

for (const platform of platforms) {
  const platformDir = join(downloadDir, platform);
  let files = [];

  try {
    files = (await readdir(platformDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && isReleaseArtifactName(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    // Platform directory doesn't exist yet, skip
    continue;
  }

  for (const name of files) {
    const path = join(platformDir, name);
    const bytes = await readFile(path);

    if (isGitLfsPointer(bytes)) {
      const existingArtifact = existingArtifacts.get(name);

      if (!existingArtifact) {
        throw new Error(`${name} is a Git LFS pointer and no previous manifest entry exists to preserve.`);
      }

      artifacts.push(existingArtifact);
      continue;
    }

    if (bytes.length <= 1024) {
      throw new Error(`${name} looks too small to be a real download artifact.`);
    }

    if (name.endsWith(".exe") && bytes.length < 10 * 1024 * 1024) {
      throw new Error(`${name} is too small to be a real Windows application download.`);
    }

    artifacts.push({
      name,
      platform: inferPlatform(name),
      format: inferFormat(name),
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      releaseSource: "GitHub Releases",
      ...(isWindowsZip(name) ? { recommendedLaunchFile: "Coder Desktop.exe" } : {})
    });
  }
}

await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      version,
      generatedAt: new Date().toISOString(),
      artifacts,
      notes:
        "Release binaries are published through GitHub Releases. macOS application ZIPs must be built on macOS or by the macOS GitHub Actions workflow."
    },
    null,
    2
  )}\n`,
  "utf8"
);

async function readExistingManifest(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function isGitLfsPointer(bytes) {
  return bytes.length <= 1024 && bytes.toString("utf8").startsWith("version https://git-lfs.github.com/spec/v1");
}

function inferPlatform(name) {
  if (name.includes("-win-") || name.includes("-win.")) {
    return "Windows";
  }

  if (name.includes("-mac-")) {
    return "macOS";
  }

  if (name.includes("-linux-")) {
    return "Linux";
  }

  return "Cross-platform";
}

function inferFormat(name) {
  if (name.includes("-setup-win-") && name.endsWith(".exe")) {
    return "Windows installer";
  }

  if (name.endsWith(".exe")) {
    return "Portable EXE";
  }

  if (name.endsWith(".dmg")) {
    return "DMG image";
  }

  if (name.endsWith(".AppImage")) {
    return "AppImage";
  }

  if (name.endsWith(".msi")) {
    return "MSI installer";
  }

  if (name.endsWith(".blockmap")) {
    return "Block map";
  }

  return "ZIP archive";
}

function isWindowsZip(name) {
  return name.includes("-win-") && name.endsWith(".zip");
}

function isReleaseArtifactName(name) {
  return artifactPattern.test(name);
}
