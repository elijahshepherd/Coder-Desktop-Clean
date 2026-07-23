const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

module.exports = async function stampWindowsExecutable(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const repoRoot = context.packager.projectDir;
  const appInfo = context.packager.appInfo;
  const exePath = path.join(context.appOutDir, `${appInfo.productFilename}.exe`);
  const rcedit = path.join(repoRoot, "node_modules", "electron-winstaller", "vendor", "rcedit.exe");
  const icon = path.join(repoRoot, "build", "icon.ico");
  const manifest = path.join(repoRoot, "build", "app.manifest");

  const args = [
      exePath,
      "--set-version-string", "FileDescription", "Coder Desktop - Local-first AI coding workspace",
      "--set-version-string", "ProductName", "Coder Desktop",
      "--set-version-string", "CompanyName", "Elijah Shepherd",
      "--set-version-string", "InternalName", "Coder Desktop",
      "--set-version-string", "OriginalFilename", path.basename(exePath),
      "--set-version-string", "LegalCopyright", "Copyright (c) 2026 Elijah Shepherd",
      "--set-version-string", "LegalTrademarks", "Coder Desktop is open source software",
      "--set-version-string", "Comments", "Local-first AI coding workspace for focused desktop software development",
      "--set-file-version", appInfo.version,
      "--set-product-version", appInfo.version,
      "--set-icon", icon
    ];

  // Embed manifest if it exists (for proper DPI awareness, execution level, etc.)
  if (fs.existsSync(manifest)) {
    args.push("--set-manifest", manifest);
  }

  const result = spawnSync(rcedit, args, { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(`Could not stamp Windows executable: ${result.stderr || result.stdout || "rcedit failed"}`);
  }
};
