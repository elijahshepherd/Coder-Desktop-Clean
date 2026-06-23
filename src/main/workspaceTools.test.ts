import { mkdtemp, mkdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  countWorkspaceFiles,
  countWorkspaceFolders,
  countWorkspaceLines,
  createWorkspaceFolder,
  deleteWorkspaceFile,
  deleteWorkspaceFolder,
  listWorkspaceFiles,
  readWorkspaceFile,
  runWorkspaceCommand,
  writeWorkspaceFile
} from "./workspaceTools";
import type { SecuritySettings } from "../shared/types";

const security: SecuritySettings = {
  accessMode: "approve",
  allowFileRead: true,
  allowFileEdit: true,
  allowShellExecute: true,
  allowInternetAccess: true,
  requirePermissionPrompts: true
};

describe("local file and shell tools", () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "coder-desktop-tools-"));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { force: true, recursive: true });
  });

  it("reads and writes files inside the preferred folder", async () => {
    await writeFile(path.join(workspaceRoot, "notes.txt"), "Before", "utf8");

    const diff = await writeWorkspaceFile(workspaceRoot, security, "notes.txt", "After");

    expect(diff.lines.some((line) => line.type === "added" && line.value.includes("After"))).toBe(true);
    await expect(readWorkspaceFile(workspaceRoot, security, "notes.txt")).resolves.toBe("After");
  });

  it("creates nested files inside the preferred folder", async () => {
    const diff = await writeWorkspaceFile(workspaceRoot, security, "notes/today.md", "Ship it");

    expect(diff.path).toBe("notes/today.md");
    await expect(readWorkspaceFile(workspaceRoot, security, "notes/today.md")).resolves.toBe("Ship it");
  });

  it("creates and deletes folders inside the preferred folder", async () => {
    const created = await createWorkspaceFolder(workspaceRoot, security, "features/tools");

    expect(created.type).toBe("folder");
    await expect(stat(path.join(workspaceRoot, "features", "tools"))).resolves.toBeTruthy();

    const deleted = await deleteWorkspaceFolder(workspaceRoot, security, "features");

    expect(deleted.relativePath).toBe("features");
    await expect(stat(path.join(workspaceRoot, "features"))).rejects.toThrow();
  });

  it("deletes files inside the preferred folder with a diff summary", async () => {
    await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "src", "old.ts"), "export const oldValue = true;\n", "utf8");

    const diff = await deleteWorkspaceFile(workspaceRoot, security, "src/old.ts");

    expect(diff.lines.some((line) => line.type === "removed" && line.value.includes("oldValue"))).toBe(true);
    await expect(stat(path.join(workspaceRoot, "src", "old.ts"))).rejects.toThrow();
  });

  it("lists files and runs shell commands inside the preferred folder", async () => {
    await writeFile(path.join(workspaceRoot, "package.json"), "{}", "utf8");

    const resolvedRoot = await realpath(workspaceRoot);
    const files = await listWorkspaceFiles(workspaceRoot, security);
    const result = await runWorkspaceCommand(workspaceRoot, security, 'node -e "console.log(process.cwd())"');

    expect(files.some((file) => file.relativePath === "package.json")).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(resolvedRoot);
  }, 10_000);

  it("counts files, folders, and source lines without generated folders", async () => {
    await mkdir(path.join(workspaceRoot, "src", "nested"), { recursive: true });
    await mkdir(path.join(workspaceRoot, "node_modules", "pkg"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "src", "index.ts"), "const value = 1;\nconsole.log(value);\n", "utf8");
    await writeFile(path.join(workspaceRoot, "src", "nested", "view.tsx"), "export function View() {\n  return null;\n}\n", "utf8");
    await writeFile(path.join(workspaceRoot, "node_modules", "pkg", "ignored.ts"), "ignored\n", "utf8");

    await expect(countWorkspaceFiles(workspaceRoot, security)).resolves.toMatchObject({ kind: "files", total: 2 });
    await expect(countWorkspaceFolders(workspaceRoot, security)).resolves.toMatchObject({ kind: "folders", total: 2 });
    await expect(countWorkspaceLines(workspaceRoot, security)).resolves.toMatchObject({ kind: "lines", total: 5, filesChecked: 2 });
  });

  it("blocks explicit absolute file paths outside the workspace", async () => {
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), "coder-desktop-absolute-"));

    try {
      const absoluteFile = path.join(externalRoot, "outside.txt");

      await expect(writeWorkspaceFile(workspaceRoot, security, absoluteFile, "Absolute write")).rejects.toThrow(
        "outside the selected workspace"
      );
      await expect(readWorkspaceFile(workspaceRoot, security, absoluteFile)).rejects.toThrow("outside the selected workspace");
    } finally {
      await rm(externalRoot, { force: true, recursive: true });
    }
  });

  it("blocks explicit absolute folders outside the workspace", async () => {
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), "coder-desktop-list-"));

    try {
      await writeFile(path.join(workspaceRoot, "wrong.txt"), "Wrong", "utf8");
      await writeFile(path.join(externalRoot, "right.txt"), "Right", "utf8");

      await expect(listWorkspaceFiles(workspaceRoot, security, externalRoot)).rejects.toThrow("outside the selected workspace");
    } finally {
      await rm(externalRoot, { force: true, recursive: true });
    }
  });


  it("passes scoped package names to Windows shell commands without PowerShell variable expansion", async () => {
    const result = await runWorkspaceCommand(workspaceRoot, security, 'node -e "console.log(process.argv[1])" @codex');

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("@codex");
  }, 10_000);

  it("rejects oversized file reads", async () => {
    await writeFile(path.join(workspaceRoot, "large.txt"), "a".repeat(2 * 1024 * 1024 + 1), "utf8");

    await expect(readWorkspaceFile(workspaceRoot, security, "large.txt")).rejects.toThrow("too large");
  });

  it("rejects disabled file and shell permissions", async () => {
    const denied: SecuritySettings = {
      accessMode: "ask-approval",
      allowFileRead: false,
      allowFileEdit: false,
      allowShellExecute: false,
      allowInternetAccess: false,
      requirePermissionPrompts: true
    };

    await writeFile(path.join(workspaceRoot, "notes.txt"), "Before", "utf8");

    await expect(listWorkspaceFiles(workspaceRoot, denied)).rejects.toThrow("File reading is disabled");
    await expect(readWorkspaceFile(workspaceRoot, denied, "notes.txt")).rejects.toThrow("File reading is disabled");
    await expect(writeWorkspaceFile(workspaceRoot, denied, "notes.txt", "After")).rejects.toThrow("File editing is disabled");
    await expect(runWorkspaceCommand(workspaceRoot, denied, "node --version")).rejects.toThrow("Shell commands are disabled");
  });

  it("rejects empty and oversized shell commands", async () => {
    await expect(runWorkspaceCommand(workspaceRoot, security, "   ")).rejects.toThrow("Enter a command");
    await expect(runWorkspaceCommand(workspaceRoot, security, "a".repeat(2001))).rejects.toThrow("too long");
  });
});
