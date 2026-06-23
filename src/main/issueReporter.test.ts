import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IssueReporter } from "./issueReporter";
import type { ChatThread } from "../shared/types";

describe("IssueReporter", () => {
  it("creates a sanitized issue for a hidden renderer failure", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    const payloads: Array<{ title: string; body: string; labels: string[] }> = [];
    const reporter = new IssueReporter({
      appVersion: "0.0.15",
      dataPath,
      createIssue: async (payload) => {
        payloads.push(payload);
        return { url: "https://github.com/elijahshepherd/Coder-Desktop/issues/1" };
      }
    });

    const result = await reporter.reportBug({
      area: "renderer",
      title: "Silent layout loop",
      message: "Resize observer failed near apiKey=sk-test-secret-1234 in C:\\Users\\Elijah\\Private",
      severity: "high",
      stack: "Error: Resize observer failed\n    at C:\\Users\\Elijah\\Private\\App.tsx:10:5"
    });

    expect(result.status).toBe("sent");
    expect(payloads).toHaveLength(1);
    expect(payloads[0].labels).toContain("Bug");
    expect(payloads[0].body).toContain("Silent layout loop");
    expect(payloads[0].body).toContain("apiKey: [redacted]");
    expect(payloads[0].body).toContain("%userprofile%");
    expect(payloads[0].body).not.toContain("sk-test-secret-1234");
    expect(payloads[0].body).not.toContain("C:\\Users\\Elijah");
  });

  it("dedupes matching bug reports to prevent issue spam", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    let createdIssues = 0;
    const reporter = new IssueReporter({
      appVersion: "0.0.15",
      dataPath,
      createIssue: async () => {
        createdIssues += 1;
        return { url: "https://github.com/elijahshepherd/Coder-Desktop/issues/2" };
      }
    });

    const first = await reporter.reportBug({
      area: "provider",
      title: "Provider timed out",
      message: "The provider timed out after the request started.",
      severity: "medium"
    });
    const second = await reporter.reportBug({
      area: "provider",
      title: "Provider timed out",
      message: "The provider timed out after the request started.",
      severity: "medium"
    });

    expect(first.status).toBe("sent");
    expect(second.status).toBe("skipped");
    expect(createdIssues).toBe(1);
  });

  it("creates like and dislike feedback issues with safe chat context", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    const payloads: Array<{ title: string; body: string; labels: string[] }> = [];
    const chat: ChatThread = {
      id: "chat-1",
      title: "Image mockup",
      provider: "openai",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Create an icon direction without using token=private",
          createdAt: new Date().toISOString(),
          status: "complete"
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a concise direction.",
          createdAt: new Date().toISOString(),
          durationMs: 2400,
          status: "complete"
        }
      ]
    };
    const reporter = new IssueReporter({
      appVersion: "0.0.15",
      dataPath,
      createIssue: async (payload) => {
        payloads.push(payload);
        return { url: "https://github.com/elijahshepherd/Coder-Desktop/issues/3" };
      }
    });

    const result = await reporter.reportFeedback(
      {
        chatId: chat.id,
        messageId: "assistant-1",
        rating: "like",
        note: "Helpful and short"
      },
      chat
    );

    expect(result.status).toBe("sent");
    expect(payloads[0].labels).toContain("Like");
    expect(payloads[0].body).toContain("Helpful and short");
    expect(payloads[0].body).toContain("2s");
    expect(payloads[0].body).toContain("token: [redacted]");
  });

  it("saves and stays quiet when automatic GitHub creation is unavailable", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    const openedUrls: string[] = [];
    const reporter = new IssueReporter({
      appVersion: "0.0.19",
      dataPath,
      createIssue: async (payload) => ({
        status: "queued",
        url: ""
      }),
      openExternal: async (url) => {
        openedUrls.push(url);
      }
    });

    const result = await reporter.reportBug({
      area: "reporting",
      title: "No GitHub tooling available",
      message: "The user has no gh or git credential installed.",
      severity: "medium",
      source: "manual"
    });

    const pendingDir = path.join(dataPath, "pending-issue-reports");
    const pendingFiles = await readdir(pendingDir);
    const pendingReport = JSON.parse(await readFile(path.join(pendingDir, pendingFiles[0]), "utf8")) as { issueUrl: string; title: string };

    expect(result.status).toBe("queued");
    expect(result.issueUrl).toBeUndefined();
    expect(openedUrls).toEqual([]);
    expect(pendingFiles).toHaveLength(1);
    expect(pendingReport.title).toContain("No GitHub tooling available");
    expect(pendingReport.issueUrl).toBe("");
    expect(result.message).toContain("saved locally");
  });

  it("never opens an automatic fallback URL for feedback or bug reports", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    const openedUrls: string[] = [];
    const reporter = new IssueReporter({
      appVersion: "0.0.38",
      dataPath,
      createIssue: async (payload) => ({
        status: "queued",
        url: ""
      }),
      openExternal: async (url) => {
        openedUrls.push(url);
      }
    });

    await reporter.reportBug({
      area: "provider",
      title: "Provider returned no output",
      message: "The provider returned an empty response after retries.",
      severity: "medium",
      source: "provider"
    });
    await reporter.reportFeedback(
      {
        chatId: "chat-1",
        messageId: "assistant-1",
        rating: "like",
        note: "Helpful"
      },
      {
        id: "chat-1",
        title: "Helpful chat",
        provider: "openai",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "Help me",
            createdAt: new Date().toISOString(),
            status: "complete"
          },
          {
            id: "assistant-1",
            role: "assistant",
            content: "Sure thing",
            createdAt: new Date().toISOString(),
            durationMs: 1200,
            status: "complete"
          }
        ]
      }
    );

    expect(openedUrls).toEqual([]);
  });

  it("does not use queued reports as a trigger for diagnostic cascade reports", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    const payloads: Array<{ title: string; body: string; labels: string[] }> = [];
    const reporter = new IssueReporter({
      appVersion: "0.0.38",
      dataPath,
      createIssue: async (payload) => {
        payloads.push(payload);
        return { status: "queued", url: "" };
      }
    });

    const result = await reporter.runDiagnosticScan({ chatCount: 2, activeChatExists: true });

    expect(result).toBeNull();
    expect(payloads).toHaveLength(0);
  });

  it("keeps automatic fallback reports quiet when direct GitHub creation is unavailable", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    const openedUrls: string[] = [];
    const reporter = new IssueReporter({
      appVersion: "0.0.24",
      dataPath,
      createIssue: async (payload) => ({
        status: "queued",
        url: `https://github.com/elijahshepherd/Coder-Desktop/issues/new?title=${encodeURIComponent(payload.title)}`
      }),
      openExternal: async (url) => {
        openedUrls.push(url);
      }
    });

    const result = await reporter.reportBug({
      area: "provider",
      title: "Provider returned no output",
      message: "The provider returned an empty response after retries.",
      severity: "medium",
      source: "provider"
    });

    const pendingDir = path.join(dataPath, "pending-issue-reports");
    const pendingFiles = await readdir(pendingDir);

    expect(result.status).toBe("queued");
    expect(openedUrls).toEqual([]);
    expect(pendingFiles).toHaveLength(1);
  });

  it("reports provider errors with status codes and safe provider metadata", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    const payloads: Array<{ title: string; body: string; labels: string[] }> = [];
    const reporter = new IssueReporter({
      appVersion: "0.0.24",
      dataPath,
      createIssue: async (payload) => {
        payloads.push(payload);
        return { url: "https://github.com/elijahshepherd/Coder-Desktop/issues/4" };
      }
    });

    const result = await reporter.reportProviderError({
      id: "provider-error",
      provider: "nvidia",
      providerLabel: "NVIDIA",
      model: "meta/llama-3.1-70b-instruct",
      title: "NVIDIA request failed",
      message: "NVIDIA returned status 502.",
      statusCode: 502,
      createdAt: new Date().toISOString()
    });

    expect(result.status).toBe("sent");
    expect(payloads[0].labels).toContain("Auto report");
    expect(payloads[0].body).toContain("Provider failure report");
    expect(payloads[0].body).toContain("statusCode: 502");
    expect(payloads[0].body).toContain("nvidia");
  });

  it("runs hourly diagnostic scans and reports a pending report backlog", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    const pendingDir = path.join(dataPath, "pending-issue-reports");
    await mkdir(pendingDir, { recursive: true });
    await Promise.all(
      Array.from({ length: 201 }, async (_item, index) => {
        await writeFile(path.join(pendingDir, `report-${index}.json`), "{}", "utf8");
      })
    );
    const payloads: Array<{ title: string; body: string; labels: string[] }> = [];
    const reporter = new IssueReporter({
      appVersion: "0.0.24",
      dataPath,
      createIssue: async (payload) => {
        payloads.push(payload);
        return { url: "https://github.com/elijahshepherd/Coder-Desktop/issues/5" };
      }
    });

    const result = await reporter.runDiagnosticScan({ chatCount: 2, activeChatExists: true });

    expect(result?.status).toBe("sent");
    expect(payloads[0].body).toContain("Hourly diagnostic scan report");
    expect(payloads[0].body).toContain("pending issue reports");
    expect(payloads[0].body).toContain("pendingReports: 201");
  });

  it("does not open an issue when an hourly diagnostic scan finds no problems", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-reporter-"));
    let createdIssues = 0;
    const reporter = new IssueReporter({
      appVersion: "0.0.24",
      dataPath,
      createIssue: async () => {
        createdIssues += 1;
        return { url: "https://github.com/elijahshepherd/Coder-Desktop/issues/6" };
      }
    });

    const result = await reporter.runDiagnosticScan({ chatCount: 1, activeChatExists: true });

    expect(result).toBeNull();
    expect(createdIssues).toBe(0);
  });
});
