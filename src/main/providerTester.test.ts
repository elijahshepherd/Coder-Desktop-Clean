import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultProviderSettings } from "../shared/defaults";
import { IssueReporter } from "./issueReporter";
import { runProviderTest } from "./providerTester";

describe("provider tester", () => {
  let dataPath: string;

  beforeEach(async () => {
    dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-provider-test-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dataPath, { force: true, recursive: true });
  });

  it("promotes a working fallback model and reports the removed model without exposing keys", async () => {
    const providers = createDefaultProviderSettings();
    const issueBodies: string[] = [];
    const progressMessages: string[] = [];
    providers.openai.apiKey = "sk-test-secret-123456789";
    providers.openai.model = "missing-model";
    providers.openai.fallbackModels = ["good-model"];
    providers.openai.imageModel = "";
    providers.openai.imageModels = [];
    providers.claude.enabled = false;
    providers.nvidia.enabled = false;

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("not found", { status: 404 }))
        .mockResolvedValueOnce(new Response("model was not found", { status: 404 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        )
    );

    const reporter = new IssueReporter({
      appVersion: "0.0.33",
      dataPath,
      createIssue: async (payload) => {
        issueBodies.push(payload.body);
        return { url: "https://github.com/elijahshepherd/Coder-Desktop/issues/30" };
      }
    });

    const result = await runProviderTest(providers, reporter, (progress) => {
      progressMessages.push(progress.message);
    });

    expect(result.status).toBe("fixed");
    expect(result.providers.openai.model).toBe("good-model");
    expect(result.providers.openai.fallbackModels).toEqual([]);
    expect(result.removals.map((removal) => removal.model)).toContain("missing-model");
    expect(result.failures[0]).toMatchObject({
      provider: "openai",
      kind: "main-model",
      model: "missing-model",
      removed: true,
      statusCode: 404
    });
    expect(result.report?.status).toBe("sent");
    expect(issueBodies).toHaveLength(1);
    expect(issueBodies[0]).toContain("missing-model");
    expect(issueBodies[0]).not.toContain("sk-test-secret");
    expect(progressMessages.some((message) => message.includes("good-model passed"))).toBe(true);
  });

  it("skips live model checks that need API keys without creating failures or reports", async () => {
    const providers = createDefaultProviderSettings();
    const createIssue = vi.fn();
    const progressMessages: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));

    const reporter = new IssueReporter({
      appVersion: "0.0.33",
      dataPath,
      createIssue
    });

    const result = await runProviderTest(providers, reporter, (progress) => {
      progressMessages.push(progress.message);
    });

    expect(result.status).toBe("ok");
    expect(result.failures).toEqual([]);
    expect(result.removals).toEqual([]);
    expect(result.report).toBeUndefined();
    expect(createIssue).not.toHaveBeenCalled();
    expect(progressMessages.some((message) => message.includes("needs an API key"))).toBe(true);
  });

  it("removes failing NVIDIA FLUX image models when a fallback works", async () => {
    const providers = createDefaultProviderSettings();
    const createIssue = vi.fn(async (payload) => {
      expect(payload.body).toContain("black-forest-labs/flux_1-dev");
      expect(payload.body).not.toContain("nvapi-test-secret");
      return { url: "https://github.com/elijahshepherd/Coder-Desktop/issues/32" };
    });
    providers.openai.enabled = false;
    providers.claude.enabled = false;
    providers.nvidia.apiKey = "nvapi-test-secret";
    providers.nvidia.imageModel = "black-forest-labs/flux_1-dev";
    providers.nvidia.imageModels = [
      { id: "black-forest-labs/flux_1-dev", label: "FLUX.1 dev", provider: "nvidia", source: "known", quality: "quality" },
      { id: "black-forest-labs/flux_1-schnell", label: "FLUX.1 schnell", provider: "nvidia", source: "known", quality: "fast" }
    ];

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("not found", { status: 404 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        )
        .mockResolvedValueOnce(new Response("404 page not found", { status: 404 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ artifacts: [{ base64: "abc123" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        )
    );

    const reporter = new IssueReporter({
      appVersion: "0.0.33",
      dataPath,
      createIssue
    });

    const result = await runProviderTest(providers, reporter, () => undefined);

    expect(result.status).toBe("fixed");
    expect(result.removals.map((removal) => removal.model)).toEqual(["black-forest-labs/flux_1-dev"]);
    expect(result.providers.nvidia.imageModel).toBe("black-forest-labs/flux_1-schnell");
    expect(result.providers.nvidia.imageModels?.map((model) => model.id)).toEqual([
      "black-forest-labs/flux_1-schnell"
    ]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      kind: "image-model",
      model: "black-forest-labs/flux_1-dev",
      removed: true,
      statusCode: 404
    });
    expect(result.report?.status).toBe("sent");
    expect(createIssue).toHaveBeenCalledTimes(1);
  });
});
