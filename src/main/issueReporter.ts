import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  BugReportRequest,
  BugReportResult,
  ChatMessage,
  ChatThread,
  FeedbackRating,
  MessageFeedbackRequest,
  ProviderError
} from "../shared/types";

const repoOwner = "elijahshepherd";
const repoName = "Coder-Desktop";
const issueApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/issues`;
const issueWebUrl = `https://github.com/${repoOwner}/${repoName}/issues`;
const maxIssuesPerDay = 24;
const fingerprintCooldownMs = 24 * 60 * 60 * 1000;
const maxBodyLength = 12_000;
const maxDetailLength = 1_200;
const maxReportLogLength = 2_400;
const maxReportLogEvents = 30;
const pendingReportWarningCount = 200;

interface IssueReporterOptions {
  appVersion: string;
  dataPath: string;
  getActiveChat?: () => ChatThread | null;
  createIssue?: (payload: IssuePayload) => Promise<CreatedIssue>;
  openExternal?: (url: string) => Promise<void>;
}
interface IssuePayload {
  title: string;
  body: string;
  labels: string[];
  fingerprint: string;
  severity?: string;
}

interface ReporterState {
  reports: Record<string, number>;
  daily: Record<string, number>;
}

interface ReportEvent {
  type: string;
  area?: string;
  title?: string;
  message?: string;
  severity?: string;
  status?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

interface CreatedIssue {
  url: string;
  status?: "sent" | "queued";
}

export class IssueReporter {
  private readonly statePath: string;
  private readonly pendingDir: string;
  private readonly eventLogPath: string;
  private state: ReporterState = { reports: {}, daily: {} };
  private stateLoaded = false;

  constructor(private readonly options: IssueReporterOptions) {
    this.statePath = path.join(options.dataPath, "issue-reporter-state.json");
    this.pendingDir = path.join(options.dataPath, "pending-issue-reports");
    this.eventLogPath = path.join(options.dataPath, "issue-reporter-events.jsonl");
  }

  async reportFeedback(request: MessageFeedbackRequest, chat: ChatThread): Promise<BugReportResult> {
    const message = chat.messages.find((item) => item.id === request.messageId);

    if (!message || message.role !== "assistant") {
      return { status: "skipped", message: "Feedback was skipped because the assistant message was not found." };
    }

    const latestUserMessage = findNearestUserMessage(chat.messages, message.id);
    const ratingLabel = request.rating === "like" ? "Like" : "Dislike";
    const payload = this.createFeedbackIssue(request.rating, request.note, chat, message, latestUserMessage);
    return this.createIssue(payload, ratingLabel);
  }

  async reportBug(request: BugReportRequest): Promise<BugReportResult> {
    await this.recordReportEvent({
      type: `${request.source ?? "automatic"} bug detected`,
      area: request.area,
      title: request.title,
      message: request.message,
      severity: request.severity ?? "medium",
      metadata: request.metadata
    });
    const payload = await this.createBugIssue(request);
    const reportType = request.source === "manual" ? "Manual bug" : "Bug";
    const result = await this.createIssue(payload, reportType);
    await this.recordReportEvent({
      type: `${request.source ?? "automatic"} bug report result`,
      area: request.area,
      title: request.title,
      status: result.status,
      message: result.message
    });
    return result;
  }

  async reportProviderError(error: ProviderError, metadata: Record<string, string | number | boolean | null> = {}): Promise<BugReportResult> {
    return this.reportBug({
      area: "provider",
      title: error.title || "Provider error",
      message: error.message || "A provider returned an error or no usable output.",
      severity: error.statusCode && error.statusCode >= 500 ? "high" : "medium",
      source: "provider",
      metadata: {
        provider: error.provider,
        model: error.model ?? null,
        statusCode: error.statusCode ?? null,
        ...metadata
      }
    });
  }

  async runDiagnosticScan(snapshot: Record<string, string | number | boolean | null> = {}): Promise<BugReportResult | null> {
    const pendingReports = await this.countPendingReports();
    const findings: string[] = [];

    if (pendingReports > pendingReportWarningCount) {
      findings.push(`There are ${pendingReports} pending issue reports waiting for GitHub submission.`);
    }

    if (typeof snapshot.activeChatExists === "boolean" && !snapshot.activeChatExists && Boolean(snapshot.activeChatId)) {
      findings.push("The stored active chat id does not point to an existing chat.");
    }

    if (findings.length === 0) {
      await this.recordReportEvent({
        type: "hourly diagnostic scan",
        status: "ok",
        metadata: {
          pendingReports,
          ...snapshot
        }
      });
      return null;
    }

    return this.reportBug({
      area: "diagnostic scan",
      title: "Hourly diagnostic scan found app issues",
      message: findings.join("\n"),
      severity: pendingReports > pendingReportWarningCount ? "high" : "medium",
      source: "health-scan",
      metadata: {
        pendingReports,
        ...snapshot
      }
    });
  }

  private async createIssue(payload: IssuePayload, reportType: string): Promise<BugReportResult> {
    await this.loadState();

    if (this.shouldSkipFingerprint(payload.fingerprint)) {
      return {
        status: "skipped",
        message: `${reportType} report was skipped because the same issue was already sent recently.`
      };
    }

    if (this.reachedDailyLimit()) {
      return {
        status: "skipped",
        message: `${reportType} report was skipped because the daily safety limit was reached.`
      };
    }

    try {
      const issue = await (this.options.createIssue ?? createGitHubIssue)(payload);
      const queued = issue.status === "queued";
      const safeIssueUrl = queued && issue.url ? issue.url : "";

      if (queued) {
        await this.writePendingReport(payload, safeIssueUrl);
      }

      this.recordSent(payload.fingerprint);
      await this.saveState();

      return {
        status: queued ? "queued" : "sent",
        issueUrl: queued ? undefined : issue.url,
        message: queued
          ? formatQueuedMessage(reportType)
          : `${reportType} report was sent to GitHub.`
      };
    } catch (error) {
      try {
        await this.writePendingReport(payload, "");
      } catch {
        // The local cache is best-effort. GitHub availability is the source of truth.
      }

      return {
        status: "queued",
        message: formatQueuedMessage(reportType)
      };
    }
  }

  private createFeedbackIssue(
    rating: FeedbackRating,
    note: string | undefined,
    chat: ChatThread,
    assistantMessage: ChatMessage,
    latestUserMessage: ChatMessage | null
  ): IssuePayload {
    const ratingLabel = rating === "like" ? "Like" : "Dislike";
    const title = `${ratingLabel}: ${sanitizeTitle(chat.title)}`;
    const body = buildIssueBody({
      appVersion: this.options.appVersion,
      kind: `${ratingLabel} feedback`,
      summary: `A user marked an assistant message as ${rating}.`,
      fields: [
        ["Chat title", chat.title],
        ["Provider", chat.provider],
        ["Assistant duration", formatDuration(assistantMessage.durationMs)],
        ["User message", latestUserMessage?.content ?? "Not available"],
        ["Assistant message", assistantMessage.content],
        ["Feedback note", note || "No note provided"]
      ]
    });
    const fingerprint = createFingerprint(["feedback", rating, chat.title, latestUserMessage?.content ?? "", assistantMessage.content.slice(0, 300)]);

    return {
      title,
      body,
      labels: [ratingLabel, "Feedback"],
      fingerprint
    };
  }

  private async createBugIssue(request: BugReportRequest): Promise<IssuePayload> {
    const title = `Bug: ${sanitizeTitle(request.title || request.area || "Unexpected app issue")}`;
    const activeChat = this.options.getActiveChat?.() ?? null;
    const latestUserMessage = activeChat ? findLatestUserMessage(activeChat.messages) : null;
    const recentReportLog = await this.readRecentReportLog();
    const body = buildIssueBody({
      appVersion: this.options.appVersion,
      kind: formatBugReportKind(request.source),
      summary: request.message,
      fields: [
        ["Title", request.title],
        ["Area", request.area],
        ["Severity", request.severity ?? "medium"],
        ["Source", request.source ?? "automatic"],
        ["Active chat", activeChat?.title ?? "Not available"],
        ["Provider", activeChat?.provider ?? "Not available"],
        ["Latest user message", latestUserMessage?.content ?? "Not available"],
        ["Safe stack", request.stack ?? "Not available"],
        ["Metadata", formatMetadata(request.metadata)],
        ["Recent report log", recentReportLog]
      ]
    });
    const fingerprint = createFingerprint([
      "bug",
      request.source ?? "automatic",
      request.area,
      request.title,
      request.message,
      request.stack?.slice(0, 400) ?? ""
    ]);

    return {
      title,
      body,
      labels: ["Bug", "Auto report"],
      fingerprint,
      severity: request.severity ?? "medium"
    };
  }

  private shouldSkipFingerprint(fingerprint: string): boolean {
    const previous = this.state.reports[fingerprint];
    return typeof previous === "number" && Date.now() - previous < fingerprintCooldownMs;
  }

  private reachedDailyLimit(): boolean {
    const day = currentDay();
    return (this.state.daily[day] ?? 0) >= maxIssuesPerDay;
  }

  private recordSent(fingerprint: string): void {
    const day = currentDay();
    this.state.reports[fingerprint] = Date.now();
    this.state.daily[day] = (this.state.daily[day] ?? 0) + 1;
  }

  private async loadState(): Promise<void> {
    if (this.stateLoaded) {
      return;
    }

    try {
      this.state = JSON.parse(await readFile(this.statePath, "utf8")) as ReporterState;
    } catch {
      this.state = { reports: {}, daily: {} };
    }

    this.stateLoaded = true;
  }

  private async saveState(): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  private async writePendingReport(payload: IssuePayload, issueUrl: string): Promise<void> {
    await mkdir(this.pendingDir, { recursive: true });
    const report = {
      title: payload.title,
      body: payload.body.slice(0, maxBodyLength),
      labels: payload.labels,
      fingerprint: payload.fingerprint,
      severity: payload.severity,
      issueUrl,
      savedAt: new Date().toISOString()
    };
    await writeFile(path.join(this.pendingDir, `${payload.fingerprint}.json`), JSON.stringify(report, null, 2), "utf8");
  }

  private async recordReportEvent(event: ReportEvent): Promise<void> {
    try {
      await mkdir(path.dirname(this.eventLogPath), { recursive: true });
      const safeEvent = {
        ...event,
        message: event.message ? sanitizeText(event.message, maxDetailLength) : undefined,
        metadata: event.metadata ? sanitizeMetadata(event.metadata) : undefined,
        recordedAt: new Date().toISOString()
      };
      await appendFile(this.eventLogPath, `${JSON.stringify(safeEvent)}\n`, "utf8");
    } catch {
      // Reporting logs must never become a new user-facing failure.
    }
  }

  private async readRecentReportLog(): Promise<string> {
    try {
      const content = await readFile(this.eventLogPath, "utf8");
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-maxReportLogEvents);

      if (lines.length === 0) {
        return "No recent report events.";
      }

      return lines.join("\n").slice(-maxReportLogLength);
    } catch {
      return "No recent report events.";
    }
  }

  private async countPendingReports(): Promise<number> {
    try {
      return (await readdir(this.pendingDir)).filter((file) => file.endsWith(".json")).length;
    } catch {
      return 0;
    }
  }
}

export function installBugReportHandlers(reporter: IssueReporter): void {
  process.on("uncaughtException", (error) => {
    void reporter.reportBug({
      area: "main process",
      title: error.name || "Uncaught exception",
      message: error.message,
      severity: "critical",
      stack: error.stack
    });
  });

  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    void reporter.reportBug({
      area: "main process",
      title: "Unhandled promise rejection",
      message: error.message,
      severity: "high",
      stack: error.stack
    });
  });
}

async function createGitHubIssue(payload: IssuePayload): Promise<CreatedIssue> {
  const body = payload.body.slice(0, maxBodyLength);
  const token = await readGitHubToken();

  if (token) {
    return createIssueWithFetch({ ...payload, body }, token);
  }

  return createIssueWithGhCli({ ...payload, body });
}

const ghExe = process.platform === "win32" ? "gh.exe" : "gh";

async function createIssueWithGhCli(payload: IssuePayload): Promise<CreatedIssue> {
  const bodyFile = path.join(os.tmpdir(), `coder-issue-body-${Date.now()}.md`);
  try {
    await writeFile(bodyFile, payload.body, "utf8");

    return await new Promise((resolve) => {
      const args = [
        "issue", "create",
        "--repo", `${repoOwner}/${repoName}`,
        "--title", payload.title,
        "--body-file", bodyFile
      ];

      for (const label of payload.labels) {
        args.push("--label", label);
      }

      execFile(ghExe, args, {
        timeout: 30_000,
        windowsHide: true
      }, (error, stdout) => {
        if (error) {
          resolve({ status: "queued", url: "" });
          return;
        }

        const url = stdout.trim();
        resolve({ url: url || issueWebUrl });
      });
    });
  } finally {
    try { await rm(bodyFile); } catch { /* best-effort cleanup */ }
  }
}

async function createIssueWithFetch(payload: IssuePayload, token: string): Promise<CreatedIssue> {
  const response = await fetch(issueApiUrl, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({
      title: payload.title,
      body: payload.body,
      labels: payload.labels
    }),
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub issue request failed with status ${response.status}. ${sanitizeText(text, 500)}`);
  }

  const json = (await response.json()) as { html_url?: string };
  return { url: json.html_url || issueWebUrl };
}

function buildIssueBody(input: {
  appVersion: string;
  kind: string;
  summary: string;
  fields: Array<[string, string | undefined]>;
}): string {
  const lines = [
    "# Coder Desktop report",
    "",
    `Type: ${sanitizeText(input.kind, 120)}`,
    `App version: ${sanitizeText(input.appVersion, 80)}`,
    `Reported at: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    sanitizeText(input.summary, maxDetailLength),
    "",
    "## System",
    "",
    `Platform: ${process.platform}`,
    `Release: ${sanitizeText(os.release(), 120)}`,
    `Architecture: ${process.arch}`,
    `CPUs: ${os.cpus().length}`,
    `Memory: ${Math.round(os.totalmem() / 1024 / 1024)} mb`,
    `Free memory: ${Math.round(os.freemem() / 1024 / 1024)} mb`,
    `Process uptime: ${Math.round(process.uptime())} seconds`,
    `Node: ${process.versions.node}`,
    `Electron: ${process.versions.electron ?? "Not available"}`,
    "",
    "## Details"
  ];

  for (const [label, value] of input.fields) {
    lines.push("", `### ${sanitizeText(label, 80)}`, "", codeFence(sanitizeText(value || "Not available", maxDetailLength)));
  }

  lines.push("", "Privacy: this report removes common secret patterns, trims long fields, and redacts user home paths.");
  return lines.join("\n");
}

function codeFence(value: string): string {
  return ["```text", value, "```"].join("\n");
}

function formatQueuedMessage(reportType: string): string {
  return `${reportType} report was saved locally. Will retry the next time the app talks to GitHub.`;
}

function formatMetadata(metadata: BugReportRequest["metadata"]): string {
  if (!metadata) {
    return "Not available";
  }

  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
}

function sanitizeMetadata(metadata: Record<string, string | number | boolean | null | undefined>): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      sanitizeText(key, 80),
      typeof value === "string" ? sanitizeText(value, maxDetailLength) : value ?? null
    ])
  );
}

function formatBugReportKind(source: BugReportRequest["source"]): string {
  switch (source) {
    case "manual":
      return "Manual bug report";
    case "provider":
      return "Provider failure report";
    case "health-scan":
      return "Hourly diagnostic scan report";
    case "automatic":
    default:
      return "Automatic bug report";
  }
}

function findNearestUserMessage(messages: ChatMessage[], assistantMessageId: string): ChatMessage | null {
  const index = messages.findIndex((message) => message.id === assistantMessageId);

  if (index < 0) {
    return null;
  }

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (messages[cursor].role === "user") {
      return messages[cursor];
    }
  }

  return null;
}

function findLatestUserMessage(messages: ChatMessage[]): ChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return messages[index];
    }
  }

  return null;
}

function sanitizeTitle(value: string): string {
  return sanitizeText(value, 80).replace(/[^\p{L}\p{N}\s:.'-]/gu, "").trim() || "Coder Desktop report";
}

function sanitizeText(value: string, maxLength: number): string {
  const home = os.homedir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value
    .replace(new RegExp(home, "gi"), "%userprofile%")
    .replace(/C:\\Users\\[^\\\s]+/gi, "%userprofile%")
    .replace(/(api[_-]?key|authorization|bearer|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1: [redacted]")
    .replace(/sk-[a-z0-9_-]{12,}/gi, "[redacted-openai-key]")
    .replace(/nvapi-[a-z0-9_-]{12,}/gi, "[redacted-nvidia-key]")
    .replace(/sk-ant-[a-z0-9_-]{12,}/gi, "[redacted-anthropic-key]")
    .replace(/\0/g, "")
    .slice(0, maxLength)
    .trim();
}

function createFingerprint(parts: string[]): string {
  return createHash("sha256")
    .update(parts.map((part) => sanitizeText(part, 1_000)).join("\n"))
    .digest("hex")
    .slice(0, 24);
}

async function readGitHubToken(): Promise<string | null> {
  const envToken =
    process.env.CODER_DESKTOP_GITHUB_TOKEN ||
    process.env.CODER_DESKTOP_BUG_REPORT_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    null;

  if (envToken && envToken.trim().length > 0) {
    return envToken.trim();
  }

  return null;
}

function currentDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDuration(durationMs: number | undefined): string {
  if (!durationMs || durationMs < 0) {
    return "Not available";
  }

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
