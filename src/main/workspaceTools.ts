import { type Change, diffLines } from "diff";
import { execFile } from "node:child_process";
import { lstat, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { resolveWorkspacePath } from "../shared/workspace";
import type { DiffLine, DiffPreview, FileEntry, SecuritySettings, ShellResult } from "../shared/types";

const execFileAsync = promisify(execFile);
const ignoredFolders = new Set([".git", "node_modules", "dist", "release", ".vite", ".cache"]);
const sourceCodeExtensions = new Set([
  ".astro",
  ".bat",
  ".c",
  ".cfg",
  ".cmake",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".gradle",
  ".h",
  ".hpp",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".md",
  ".mdx",
  ".php",
  ".proto",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".xml",
  ".yaml",
  ".yml"
]);
const sourceCodeNames = new Set(["dockerfile", "license", "makefile", "readme"]);
const maxReadableFileBytes = 2 * 1024 * 1024;
const maxCommandLength = 2_000;
const maxCountedEntries = 100_000;

export interface WorkspaceCountResult {
  kind: "files" | "folders" | "lines";
  path: string;
  total: number;
  filesChecked?: number;
  foldersChecked?: number;
  skipped?: number;
}

export async function listWorkspaceFiles(workspaceRoot: string, security: SecuritySettings, requestedPath = ""): Promise<FileEntry[]> {
  ensureAllowed(security.allowFileRead, "File reading is disabled in security settings.");

  const root = requestedPath.trim() ? await resolveExistingWorkspacePath(workspaceRoot, requestedPath) : await realpath(workspaceRoot);
  const metadata = await stat(root);

  if (!metadata.isDirectory()) {
    throw new Error("Only folders can be listed.");
  }

  const results: FileEntry[] = [];
  await walk(root, root, results, 0);
  return results.sort((first, second) => first.relativePath.localeCompare(second.relativePath)).slice(0, 500);
}

export async function readWorkspaceFile(
  workspaceRoot: string,
  security: SecuritySettings,
  relativePath: string
): Promise<string> {
  ensureAllowed(security.allowFileRead, "File reading is disabled in security settings.");
  const filePath = await resolveExistingWorkspacePath(workspaceRoot, relativePath);
  const metadata = await stat(filePath);

  if (!metadata.isFile()) {
    throw new Error("Only files can be read.");
  }

  if (metadata.size > maxReadableFileBytes) {
    throw new Error("That file is too large to read safely.");
  }

  return readFile(filePath, "utf8");
}

export async function countWorkspaceFiles(
  workspaceRoot: string,
  security: SecuritySettings,
  requestedPath = ""
): Promise<WorkspaceCountResult> {
  ensureAllowed(security.allowFileRead, "File reading is disabled in security settings.");
  const root = await resolveCountRoot(workspaceRoot, requestedPath);
  const counts = await countEntries(root, "files");

  return {
    kind: "files",
    path: root,
    total: counts.files,
    foldersChecked: counts.folders,
    skipped: counts.skipped
  };
}

export async function countWorkspaceFolders(
  workspaceRoot: string,
  security: SecuritySettings,
  requestedPath = ""
): Promise<WorkspaceCountResult> {
  ensureAllowed(security.allowFileRead, "File reading is disabled in security settings.");
  const root = await resolveCountRoot(workspaceRoot, requestedPath);
  const counts = await countEntries(root, "folders");

  return {
    kind: "folders",
    path: root,
    total: counts.folders,
    filesChecked: counts.files,
    skipped: counts.skipped
  };
}

export async function countWorkspaceLines(
  workspaceRoot: string,
  security: SecuritySettings,
  requestedPath = ""
): Promise<WorkspaceCountResult> {
  ensureAllowed(security.allowFileRead, "File reading is disabled in security settings.");
  const root = await resolveCountRoot(workspaceRoot, requestedPath);
  const counts = await countSourceLines(root);

  return {
    kind: "lines",
    path: root,
    total: counts.lines,
    filesChecked: counts.files,
    skipped: counts.skipped
  };
}

export async function previewWorkspaceDiff(
  workspaceRoot: string,
  security: SecuritySettings,
  relativePath: string,
  nextContent: string
): Promise<DiffPreview> {
  ensureAllowed(security.allowFileRead, "File reading is disabled in security settings.");
  const current = await readWorkspaceFile(workspaceRoot, security, relativePath);

  return createDiff(relativePath, current, nextContent);
}

export async function writeWorkspaceFile(
  workspaceRoot: string,
  security: SecuritySettings,
  relativePath: string,
  nextContent: string
): Promise<DiffPreview> {
  ensureAllowed(security.allowFileEdit, "File editing is disabled in security settings.");
  const filePath = await resolveWritableWorkspacePath(workspaceRoot, relativePath);
  const current = await readFile(filePath, "utf8").catch(() => "");
  const preview = createDiff(relativePath, current, nextContent);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, nextContent, "utf8");

  return preview;
}

export async function createWorkspaceFolder(
  workspaceRoot: string,
  security: SecuritySettings,
  relativePath: string
): Promise<FileEntry> {
  ensureAllowed(security.allowFileEdit, "File editing is disabled in security settings.");
  const folderPath = await resolveWritableWorkspacePath(workspaceRoot, relativePath);
  const realRoot = await realpath(workspaceRoot);

  if (path.resolve(folderPath) === realRoot) {
    throw new Error("Choose a folder name instead of the working folder itself.");
  }

  await mkdir(folderPath, { recursive: true });
  return createFileEntry(realRoot, await realpath(folderPath));
}

export async function deleteWorkspaceFile(
  workspaceRoot: string,
  security: SecuritySettings,
  relativePath: string
): Promise<DiffPreview> {
  ensureAllowed(security.allowFileEdit, "File editing is disabled in security settings.");
  const filePath = await resolveExistingWorkspacePath(workspaceRoot, relativePath);
  const metadata = await lstat(filePath);

  if (metadata.isSymbolicLink()) {
    throw new Error("Symbolic links cannot be deleted from Coder Desktop.");
  }

  if (!metadata.isFile()) {
    throw new Error("Only files can be deleted with the file delete tool.");
  }

  const current = await readFile(filePath, "utf8");
  const preview = createDiff(relativePath, current, "");
  await rm(filePath, { force: false });
  return preview;
}

export async function deleteWorkspaceFolder(
  workspaceRoot: string,
  security: SecuritySettings,
  relativePath: string
): Promise<FileEntry> {
  ensureAllowed(security.allowFileEdit, "File editing is disabled in security settings.");
  const folderPath = await resolveExistingWorkspacePath(workspaceRoot, relativePath);
  const metadata = await lstat(folderPath);
  const realRoot = await realpath(workspaceRoot);

  if (metadata.isSymbolicLink()) {
    throw new Error("Symbolic links cannot be deleted from Coder Desktop.");
  }

  if (!metadata.isDirectory()) {
    throw new Error("Only folders can be deleted with the folder delete tool.");
  }

  if (folderPath === realRoot) {
    throw new Error("The working folder itself cannot be deleted.");
  }

  const entry = await createFileEntry(realRoot, folderPath);
  await rm(folderPath, { force: false, recursive: true });
  return entry;
}

export async function runWorkspaceCommand(
  workspaceRoot: string,
  security: SecuritySettings,
  command: string,
  signal?: AbortSignal
): Promise<ShellResult> {
  const cwd = await realpath(workspaceRoot);
  return runNativeShellCommand(cwd, security, command, signal);
}

export async function runNativeShellCommand(
  workingDirectory: string,
  security: SecuritySettings,
  command: string,
  signal?: AbortSignal
): Promise<ShellResult> {
  ensureRunnableShellCommand(security, command);
  const trimmedCommand = command.trim();
  const startedAt = Date.now();
  const cwd = await realpath(workingDirectory);
  const executable = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", trimmedCommand] : ["-lc", trimmedCommand];

  try {
    const result = await execFileAsync(executable, args, {
      cwd,
      timeout: 90_000,
      windowsVerbatimArguments: process.platform === "win32",
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      signal
    });

    return {
      command: trimmedCommand,
      cwd,
      exitCode: 0,
      stdout: trimOutput(result.stdout),
      stderr: trimOutput(result.stderr),
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    const commandError = error as { code?: number; stdout?: string; stderr?: string; message?: string };
    return {
      command: trimmedCommand,
      cwd,
      exitCode: commandError.code ?? null,
      stdout: trimOutput(commandError.stdout ?? ""),
      stderr: trimOutput(commandError.stderr ?? commandError.message ?? ""),
      durationMs: Date.now() - startedAt
    };
  }
}

export async function runPowerShellCommand(
  workingDirectory: string,
  security: SecuritySettings,
  command: string,
  signal?: AbortSignal
): Promise<ShellResult> {
  ensureRunnableShellCommand(security, command);
  const trimmedCommand = command.trim();
  const startedAt = Date.now();
  const cwd = await realpath(workingDirectory);
  const executable = process.platform === "win32" ? "powershell.exe" : "pwsh";

  try {
    const result = await execFileAsync(executable, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", trimmedCommand], {
      cwd,
      timeout: 45_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      signal
    });

    return {
      command: trimmedCommand,
      cwd,
      exitCode: 0,
      stdout: trimOutput(result.stdout),
      stderr: trimOutput(result.stderr),
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    const commandError = error as { code?: number; stdout?: string; stderr?: string; message?: string };
    return {
      command: trimmedCommand,
      cwd,
      exitCode: commandError.code ?? null,
      stdout: trimOutput(commandError.stdout ?? ""),
      stderr: trimOutput(commandError.stderr ?? commandError.message ?? ""),
      durationMs: Date.now() - startedAt
    };
  }
}

function ensureRunnableShellCommand(security: SecuritySettings, command: string): void {
  ensureAllowed(security.allowShellExecute, "Shell commands are disabled in security settings.");
  const trimmedCommand = command.trim();

  if (!trimmedCommand) {
    throw new Error("Enter a command before running shell tools.");
  }

  if (trimmedCommand.length > maxCommandLength) {
    throw new Error("That command is too long to run safely.");
  }
}

async function createFileEntry(root: string, absolutePath: string): Promise<FileEntry> {
  const metadata = await stat(absolutePath);

  return {
    name: path.basename(absolutePath),
    path: absolutePath,
    relativePath: path.relative(root, absolutePath),
    type: metadata.isDirectory() ? "folder" : "file",
    size: metadata.size,
    updatedAt: metadata.mtime.toISOString()
  };
}

async function walk(root: string, currentPath: string, results: FileEntry[], depth: number): Promise<void> {
  if (depth > 5 || results.length >= 500) {
    return;
  }

  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (results.length >= 500) {
      return;
    }

    if (entry.isDirectory() && ignoredFolders.has(entry.name)) {
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);
    const metadata = await stat(absolutePath);
    const relativePath = path.relative(root, absolutePath);

    results.push({
      name: entry.name,
      path: absolutePath,
      relativePath,
      type: entry.isDirectory() ? "folder" : "file",
      size: metadata.size,
      updatedAt: metadata.mtime.toISOString()
    });

    if (entry.isDirectory()) {
      await walk(root, absolutePath, results, depth + 1);
    }
  }
}

async function resolveCountRoot(workspaceRoot: string, requestedPath: string): Promise<string> {
  return requestedPath.trim() ? resolveExistingWorkspacePath(workspaceRoot, requestedPath) : realpath(workspaceRoot);
}

async function countEntries(root: string, target: "files" | "folders"): Promise<{ files: number; folders: number; skipped: number }> {
  const metadata = await lstat(root);

  if (metadata.isSymbolicLink()) {
    return { files: 0, folders: 0, skipped: 1 };
  }

  if (metadata.isFile()) {
    return { files: target === "files" ? 1 : 0, folders: 0, skipped: 0 };
  }

  if (!metadata.isDirectory()) {
    return { files: 0, folders: 0, skipped: 1 };
  }

  const counts = { files: 0, folders: 0, skipped: 0 };
  await walkCounts(root, counts);
  return counts;
}

async function walkCounts(currentPath: string, counts: { files: number; folders: number; skipped: number }): Promise<void> {
  if (counts.files + counts.folders >= maxCountedEntries) {
    counts.skipped += 1;
    return;
  }

  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      counts.skipped += 1;
      continue;
    }

    if (entry.isDirectory()) {
      if (ignoredFolders.has(entry.name)) {
        counts.skipped += 1;
        continue;
      }

      counts.folders += 1;
      await walkCounts(path.join(currentPath, entry.name), counts);
      continue;
    }

    if (entry.isFile()) {
      counts.files += 1;
    }
  }
}

async function countSourceLines(root: string): Promise<{ lines: number; files: number; skipped: number }> {
  const metadata = await lstat(root);

  if (metadata.isSymbolicLink()) {
    return { lines: 0, files: 0, skipped: 1 };
  }

  if (metadata.isFile()) {
    return isSourceFile(root) ? countLinesInFile(root) : { lines: 0, files: 0, skipped: 1 };
  }

  if (!metadata.isDirectory()) {
    return { lines: 0, files: 0, skipped: 1 };
  }

  const counts = { lines: 0, files: 0, skipped: 0 };
  await walkSourceLines(root, counts);
  return counts;
}

async function walkSourceLines(currentPath: string, counts: { lines: number; files: number; skipped: number }): Promise<void> {
  if (counts.files >= maxCountedEntries) {
    counts.skipped += 1;
    return;
  }

  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      counts.skipped += 1;
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (ignoredFolders.has(entry.name)) {
        counts.skipped += 1;
        continue;
      }

      await walkSourceLines(absolutePath, counts);
      continue;
    }

    if (!entry.isFile() || !isSourceFile(absolutePath)) {
      continue;
    }

    const result = await countLinesInFile(absolutePath);
    counts.lines += result.lines;
    counts.files += result.files;
    counts.skipped += result.skipped;
  }
}

async function countLinesInFile(filePath: string): Promise<{ lines: number; files: number; skipped: number }> {
  const metadata = await stat(filePath);

  if (metadata.size > maxReadableFileBytes) {
    return { lines: 0, files: 0, skipped: 1 };
  }

  try {
    const content = await readFile(filePath, "utf8");
    const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");
    const lines = normalized.length ? normalized.split("\n").length : 0;
    return { lines, files: 1, skipped: 0 };
  } catch {
    return { lines: 0, files: 0, skipped: 1 };
  }
}

function isSourceFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath).toLowerCase();
  return sourceCodeExtensions.has(extension) || sourceCodeNames.has(name);
}

async function resolveExistingWorkspacePath(workspaceRoot: string, requestedPath: string): Promise<string> {
  const lexicalPath = resolveWorkspacePath(workspaceRoot, requestedPath);
  return realpath(lexicalPath);
}

async function resolveWritableWorkspacePath(workspaceRoot: string, requestedPath: string): Promise<string> {
  const lexicalPath = resolveWorkspacePath(workspaceRoot, requestedPath);

  try {
    const metadata = await lstat(lexicalPath);

    if (metadata.isSymbolicLink()) {
      throw new Error("Symbolic links cannot be edited from Coder Desktop.");
    }

    return resolveExistingWorkspacePath(workspaceRoot, requestedPath);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
  }

  const realParent = await resolveExistingWritableAncestor(path.dirname(lexicalPath));

  if (!realParent) {
    throw new Error("Could not find a writable folder for that path.");
  }

  return lexicalPath;
}

async function resolveExistingWritableAncestor(startPath: string): Promise<string> {
  let currentPath = startPath;

  while (true) {
    try {
      const metadata = await lstat(currentPath);

      if (metadata.isSymbolicLink()) {
        throw new Error("Symbolic links cannot be edited from Coder Desktop.");
      }

      if (!metadata.isDirectory()) {
        throw new Error("Files can only be created below folders.");
      }

      return realpath(currentPath);
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }

      const parentPath = path.dirname(currentPath);

      if (parentPath === currentPath) {
        throw new Error("Could not find a writable folder for that path.");
      }

      currentPath = parentPath;
    }
  }
}

function createDiff(relativePath: string, current: string, next: string): DiffPreview {
  const lines: DiffLine[] = (diffLines(current, next) as Change[]).flatMap((part, partIndex) => {
    const type: DiffLine["type"] = part.added ? "added" : part.removed ? "removed" : "unchanged";

    return part.value.split(/(?<=\n)/).filter(Boolean).map((value, lineIndex) => ({
      id: `${partIndex}-${lineIndex}`,
      type,
      value
    }));
  });

  return {
    path: relativePath,
    lines
  };
}

function ensureAllowed(allowed: boolean, message: string): void {
  if (!allowed) {
    throw new Error(message);
  }
}

function trimOutput(value: string): string {
  return value.length > 20_000 ? `${value.slice(0, 20_000)}\n\nOutput was trimmed.` : value;
}

function isMissingPathError(error: unknown): boolean {
  return isErrorWithCode(error) && error.code === "ENOENT";
}

function isErrorWithCode(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error;
}
