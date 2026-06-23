import path from "node:path";
import type { DiffPreview, FileEntry, ShellResult, ToolActivity, ToolMetric, WorkspaceToolActivity } from "../shared/types";
import { extractCoderToolPayloads } from "./coderToolMarkup";
import { formatInternetToolContent } from "./internetToolRequests";
import type { WorkspaceCountResult } from "./workspaceTools";

export type WorkspaceToolRequestType =
  | "list-files"
  | "read-file"
  | "count-files"
  | "count-folders"
  | "count-lines"
  | "write-file"
  | "create-file"
  | "delete-file"
  | "create-folder"
  | "delete-folder"
  | "run-shell";

export interface WorkspaceToolRequest {
  type: WorkspaceToolRequestType;
  path?: string;
  content?: string;
  command?: string;
  reason?: string;
}

export interface WorkspaceToolPlan {
  request: WorkspaceToolRequest;
  activity: WorkspaceToolActivity;
}

const requestTypes = new Set<WorkspaceToolRequestType>([
  "list-files",
  "read-file",
  "count-files",
  "count-folders",
  "count-lines",
  "write-file",
  "create-file",
  "delete-file",
  "create-folder",
  "delete-folder",
  "run-shell"
]);

export function parseWorkspaceToolRequest(content: string): WorkspaceToolPlan | null {
  return parseWorkspaceToolRequests(content)[0] ?? null;
}

export function detectWorkspaceToolPlans(content: string): WorkspaceToolPlan[] {
  const plans: WorkspaceToolPlan[] = [];
  const explicitPath = extractWindowsPath(content);
  const lower = content.toLowerCase();

  if (explicitPath && /\b(list|read|explore|inspect|check|look|game|project|folder|files?)\b/i.test(content)) {
    const type: WorkspaceToolRequestType =
      looksLikeFilePath(explicitPath) && /\b(read|inspect|check|look|file)\b/i.test(content) ? "read-file" : "list-files";
    const request: WorkspaceToolRequest = {
      type,
      path: explicitPath,
      reason: type === "read-file" ? `Read ${explicitPath}` : `Explore ${explicitPath}`
    };
    plans.push({ request, activity: createWorkspaceToolActivity(request) });
  }

  const shouldCreateLicense =
    Boolean(explicitPath) && /\b(create|add|write|make)\b/.test(lower) && /\b(license|licence|lisecnec|lisence)\b/.test(lower);

  if (/\b(how many|count)\b/.test(lower) && /\b(lines|line count|loc|code lines)\b/.test(lower)) {
    const request: WorkspaceToolRequest = {
      type: "count-lines",
      path: explicitPath ?? undefined,
      reason: explicitPath ? `Count source lines in ${explicitPath}` : "Count source lines in the selected workspace"
    };
    plans.push({ request, activity: createWorkspaceToolActivity(request) });
  }

  if (/\b(how many|count)\b/.test(lower) && /\b(files?)\b/.test(lower)) {
    const request: WorkspaceToolRequest = {
      type: "count-files",
      path: explicitPath ?? undefined,
      reason: explicitPath ? `Count files in ${explicitPath}` : "Count files in the selected workspace"
    };
    plans.push({ request, activity: createWorkspaceToolActivity(request) });
  }

  if (/\b(how many|count)\b/.test(lower) && /\b(folders?|directories)\b/.test(lower)) {
    const request: WorkspaceToolRequest = {
      type: "count-folders",
      path: explicitPath ?? undefined,
      reason: explicitPath ? `Count folders in ${explicitPath}` : "Count folders in the selected workspace"
    };
    plans.push({ request, activity: createWorkspaceToolActivity(request) });
  }

  if (shouldCreateLicense && explicitPath) {
    const request: WorkspaceToolRequest = {
      type: "create-file",
      path: path.join(explicitPath, "LICENSE.md"),
      content: createMitLicenseContent(),
      reason: `Create MIT license file in ${explicitPath}`
    };
    plans.push({ request, activity: createWorkspaceToolActivity(request) });
  }

  return dedupeDirectPlans(plans);
}

export function parseWorkspaceToolRequests(content: string): WorkspaceToolPlan[] {
  const plans: WorkspaceToolPlan[] = [];

  for (const payload of extractCoderToolPayloads(content)) {
    try {
      const request = normalizeRequest(JSON.parse(payload) as Record<string, unknown>);

      if (request) {
        plans.push({
          request,
          activity: createWorkspaceToolActivity(request)
        });
      }
    } catch {
      continue;
    }
  }

  return plans;
}

export function createWorkspaceToolActivity(request: WorkspaceToolRequest): WorkspaceToolActivity {
  const target = request.path ? normalizeDisplayPath(request.path) : undefined;
  const name = target ? path.basename(target) || target : undefined;
  const description = request.reason || defaultDescription(request);

  switch (request.type) {
    case "list-files":
      return {
        kind: "file-list",
        title: target ? `Reading ${name}` : "Reading files",
        description,
        group: "Files",
        target
      };
    case "read-file":
      return {
        kind: "file-read",
        title: `Reading ${name}`,
        description,
        group: "Files",
        target
      };
    case "count-files":
      return {
        kind: "file-count",
        title: "Counting files",
        description,
        group: "Files",
        target
      };
    case "count-folders":
      return {
        kind: "folder-count",
        title: "Counting folders",
        description,
        group: "Folders",
        target
      };
    case "count-lines":
      return {
        kind: "line-count",
        title: "Counting lines",
        description,
        group: "Files",
        target
      };
    case "write-file":
      return {
        kind: "file-write",
        title: `Editing ${name}`,
        description,
        group: "Files",
        target,
        metrics: createPendingContentMetrics(request.content)
      };
    case "create-file":
      return {
        kind: "file-create",
        title: `Creating ${name}`,
        description,
        group: "Files",
        target,
        metrics: createPendingContentMetrics(request.content)
      };
    case "delete-file":
      return {
        kind: "file-delete",
        title: `Deleting ${name}`,
        description,
        group: "Files",
        target,
        metrics: [{ label: "Staged", value: "-1", tone: "removed" }]
      };
    case "create-folder":
      return {
        kind: "folder-create",
        title: `Creating ${name}`,
        description,
        group: "Folders",
        target
      };
    case "delete-folder":
      return {
        kind: "folder-delete",
        title: `Deleting ${name}`,
        description,
        group: "Folders",
        target,
        metrics: [{ label: "Staged", value: "-1", tone: "removed" }]
      };
    case "run-shell":
      return {
        kind: "shell-command",
        title: "Running shell command",
        description,
        group: "Shell",
        command: request.command?.trim()
      };
  }
}

export function completeFileListActivity(activity: WorkspaceToolActivity, files: FileEntry[]): WorkspaceToolActivity {
  return {
    ...activity,
    title: "Read files",
    preview: files.slice(0, 24).map((file) => file.relativePath).join("\n") || "No files were found."
  };
}

export function completeReadActivity(activity: WorkspaceToolActivity, content: string): WorkspaceToolActivity {
  return {
    ...activity,
    title: activity.title.replace(/^Reading\b/, "Read"),
    preview: content.slice(0, 2_800)
  };
}

export function completeCountActivity(activity: WorkspaceToolActivity, result: WorkspaceCountResult): WorkspaceToolActivity {
  const label = result.kind === "files" ? "Files" : result.kind === "folders" ? "Folders" : "Lines";
  const extraMetrics: ToolMetric[] = [];

  if (typeof result.filesChecked === "number") {
    extraMetrics.push({ label: "Files checked", value: String(result.filesChecked) });
  }

  if (typeof result.foldersChecked === "number") {
    extraMetrics.push({ label: "Folders checked", value: String(result.foldersChecked) });
  }

  if (result.skipped) {
    extraMetrics.push({ label: "Skipped", value: String(result.skipped) });
  }

  return {
    ...activity,
    title: `Counted ${label.toLowerCase()}`,
    target: normalizeDisplayPath(result.path),
    metrics: [{ label, value: String(result.total) }, ...extraMetrics],
    preview: createCountPreview(result, label)
  };
}

export function completeDiffActivity(activity: WorkspaceToolActivity, diff: DiffPreview): WorkspaceToolActivity {
  const metrics = createDiffMetrics(diff);

  return {
    ...activity,
    title: completeTitle(activity.title),
    diff,
    metrics,
    preview: createDiffPreview(diff)
  };
}

function extractWindowsPath(content: string): string | null {
  const match = /[A-Za-z]:[\\/][^\r\n"']+/u.exec(content);

  if (!match) {
    return null;
  }

  return match[0].replace(/[.?!,;:]+$/u, "").trim();
}

function looksLikeFilePath(value: string): boolean {
  const name = path.basename(value.replace(/\//g, path.sep));
  return /\.[a-z0-9]{1,12}$/i.test(name);
}

function createMitLicenseContent(): string {
  const year = new Date().getFullYear();

  return [
    "# MIT License",
    "",
    `Copyright (c) ${year}`,
    "",
    "Permission is hereby granted, free of charge, to any person obtaining a copy",
    "of this software and associated documentation files (the \"Software\"), to deal",
    "in the Software without restriction, including without limitation the rights",
    "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
    "copies of the Software, and to permit persons to whom the Software is",
    "furnished to do so, subject to the following conditions:",
    "",
    "The above copyright notice and this permission notice shall be included in all",
    "copies or substantial portions of the Software.",
    "",
    "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR",
    "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,",
    "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE",
    "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER",
    "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,",
    "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE",
    "SOFTWARE.",
    ""
  ].join("\n");
}

function dedupeDirectPlans(plans: WorkspaceToolPlan[]): WorkspaceToolPlan[] {
  const seen = new Set<string>();

  return plans.filter((plan) => {
    const key = `${plan.request.type}:${plan.request.path ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function completeFolderActivity(activity: WorkspaceToolActivity, entry: FileEntry): WorkspaceToolActivity {
  return {
    ...activity,
    title: completeTitle(activity.title),
    metrics: [
      { label: "Folder", value: entry.relativePath || entry.name },
      { label: "Updated", value: new Date(entry.updatedAt).toLocaleDateString("en-US") }
    ]
  };
}

export function completeShellActivity(activity: WorkspaceToolActivity, result: ShellResult): WorkspaceToolActivity {
  return {
    ...activity,
    title: result.exitCode === 0 ? "Ran shell command" : "Shell command failed",
    command: result.command,
    result,
    metrics: [
      { label: "Exit", value: String(result.exitCode ?? "unknown"), tone: result.exitCode === 0 ? "neutral" : "danger" }
    ],
    preview: (result.stdout || result.stderr || "No command output.").slice(0, 2_800)
  };
}

export function formatToolActivityContent(activity: ToolActivity): string {
  if (activity.kind === "web-search" || activity.kind === "web-fetch" || activity.kind === "web-batch-fetch" || activity.kind === "web-screen-pull") {
    return formatInternetToolContent(activity);
  }

  if (activity.kind === "windows-ps-group") {
    const output = activity.result?.stdout || activity.result?.stderr || "";
    return [
      `Tool activity: ${activity.title}`,
      "Type: Windows PowerShell",
      `Command: ${activity.command}`,
      `Status: ${activity.result ? "complete" : "running"}`,
      activity.result ? `Exit code: ${activity.result.exitCode ?? "unknown"}` : "",
      output ? `Output:\n${output.slice(0, 8_000)}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Tool activity: ${activity.title}`,
    `Type: ${activity.kind}`,
    "target" in activity && activity.target ? `Path: ${activity.target}` : "",
    "command" in activity && activity.command ? `Command: ${activity.command}` : "",
    activity.metrics?.length ? `Summary: ${activity.metrics.map((metric) => `${metric.label} ${metric.value}`).join(", ")}` : "",
    activity.preview ? `Result:\n${activity.preview.slice(0, 8_000)}` : "Status: running"
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeRequest(input: Record<string, unknown>): WorkspaceToolRequest | null {
  if (typeof input.type !== "string" || !requestTypes.has(input.type as WorkspaceToolRequestType)) {
    return null;
  }

  const request: WorkspaceToolRequest = {
    type: input.type as WorkspaceToolRequestType,
    path: typeof input.path === "string" ? input.path.trim() : undefined,
    content: typeof input.content === "string" ? input.content : undefined,
    command: typeof input.command === "string" ? input.command.trim() : undefined,
    reason: typeof input.reason === "string" ? input.reason.trim().slice(0, 220) : undefined
  };

  if (requiresPath(request.type) && !request.path) {
    return null;
  }

  if ((request.type === "write-file" || request.type === "create-file") && typeof request.content !== "string") {
    return null;
  }

  if (request.type === "run-shell" && !request.command) {
    return null;
  }

  return request;
}

function requiresPath(type: WorkspaceToolRequestType): boolean {
  return type !== "list-files" && type !== "count-files" && type !== "count-folders" && type !== "count-lines" && type !== "run-shell";
}

function defaultDescription(request: WorkspaceToolRequest): string {
  switch (request.type) {
    case "list-files":
      return "Listing files and folders.";
    case "read-file":
      return "Reading file contents.";
    case "count-files":
      return "Counting files in a folder.";
    case "count-folders":
      return "Counting folders in a folder.";
    case "count-lines":
      return "Counting source lines without installed dependencies or generated folders.";
    case "write-file":
      return "Writing reviewed content into a file.";
    case "create-file":
      return "Creating a new file.";
    case "delete-file":
      return "Deleting a file.";
    case "create-folder":
      return "Creating a folder.";
    case "delete-folder":
      return "Deleting a folder.";
    case "run-shell":
      return "Running a shell command.";
  }
}

function createCountPreview(result: WorkspaceCountResult, label: string): string {
  const lines = [`${label}: ${result.total}`, `Path: ${normalizeDisplayPath(result.path)}`];

  if (typeof result.filesChecked === "number") {
    lines.push(`Files checked: ${result.filesChecked}`);
  }

  if (typeof result.foldersChecked === "number") {
    lines.push(`Folders checked: ${result.foldersChecked}`);
  }

  if (result.skipped) {
    lines.push(`Skipped entries: ${result.skipped}`);
  }

  return lines.join("\n");
}

function normalizeDisplayPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function completeTitle(title: string): string {
  return title
    .replace(/^Creating\b/, "Created")
    .replace(/^Editing\b/, "Edited")
    .replace(/^Deleting\b/, "Deleted")
    .replace(/^Reading\b/, "Read");
}

function createDiffMetrics(diff: DiffPreview): ToolMetric[] {
  const added = diff.lines.filter((line) => line.type === "added").length;
  const removed = diff.lines.filter((line) => line.type === "removed").length;
  const metrics: ToolMetric[] = [];

  if (added > 0) {
    metrics.push({ label: "Added", value: `+${added}`, tone: "added" });
  }

  if (removed > 0) {
    metrics.push({ label: "Removed", value: `-${removed}`, tone: "removed" });
  }

  if (metrics.length === 0) {
    metrics.push({ label: "Changed", value: "0" });
  }

  return metrics;
}

function createPendingContentMetrics(content: string | undefined): ToolMetric[] | undefined {
  if (typeof content !== "string") {
    return undefined;
  }

  const lines = content.length ? content.replace(/\r\n/g, "\n").split("\n").length : 0;
  return [{ label: "Staged", value: `+${lines}`, tone: "added" }];
}

function createDiffPreview(diff: DiffPreview): string {
  return diff.lines
    .filter((line) => line.type !== "unchanged")
    .slice(0, 80)
    .map((line) => `${line.type === "added" ? "+" : "-"} ${line.value.replace(/\r?\n$/, "")}`)
    .join("\n");
}
