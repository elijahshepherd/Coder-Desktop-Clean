import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultProviderSettings } from "../shared/defaults";
import {
  detectImageGenerationPlan,
  detectImageRetryPlan,
  generateImageFromPlan,
  parseImageGenerationRequests,
  scanProviderImageModels
} from "./imageModels";

describe("imageModels", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects direct image generation requests and clamps requested counts", () => {
    expect(detectImageGenerationPlan("Create an app icon image for my project")?.prompt).toContain("app icon");
    expect(detectImageGenerationPlan("create an iameg of a dog")?.prompt).toContain("dog");
    expect(detectImageGenerationPlan("generat an image of a dog")?.prompt).toContain("dog");
    expect(detectImageGenerationPlan("generate 3 images of a dog")?.count).toBe(3);
    expect(detectImageGenerationPlan("Explain how icons work")).toBeNull();
    expect(detectImageGenerationPlan("can you create images")).toBeNull();
  });

  it("retries the latest image generation with the previous count", () => {
    const retry = detectImageRetryPlan("try again", [
      {
        id: "image",
        role: "assistant",
        content: "Generated images",
        createdAt: new Date().toISOString(),
        status: "complete",
        imageGeneration: {
          kind: "image-generation",
          title: "Generated 2 images",
          description: "The image generation finished.",
          group: "Images",
          provider: "nvidia",
          providerLabel: "NVIDIA",
          model: "black-forest-labs/flux_1-schnell",
          prompt: "A dog in a sunny park",
          images: [
            { mimeType: "image/png", dataUrl: "data:image/png;base64,one" },
            { mimeType: "image/png", dataUrl: "data:image/png;base64,two" }
          ]
        }
      }
    ]);

    expect(retry).toEqual({
      provider: "nvidia",
      model: "black-forest-labs/flux_1-schnell",
      prompt: "A dog in a sunny park",
      count: 2
    });
  });

  it("parses assistant image generation tool requests with a safe count", () => {
    const requests = parseImageGenerationRequests(
      '<coder-image>{"prompt":"Create a calm app mockup","provider":"nvidia","model":"black-forest-labs/flux_1-schnell","count":9}</coder-image>'
    );

    expect(requests).toEqual([
      {
        prompt: "Create a calm app mockup",
        provider: "nvidia",
        model: "black-forest-labs/flux_1-schnell",
        count: 3
      }
    ]);
  });

  it("reports OpenAI and Claude image generation as unavailable", async () => {
    const providers = createDefaultProviderSettings();
    providers.openai.apiKey = "test-key";
    providers.claude.apiKey = "test-key";

    await expect(scanProviderImageModels(providers, "openai")).resolves.toMatchObject({
      status: "none",
      models: []
    });
    await expect(scanProviderImageModels(providers, "claude")).resolves.toMatchObject({
      status: "none",
      models: []
    });
  });

  it("keeps only known NVIDIA FLUX image models available when scan output is empty", async () => {
    const providers = createDefaultProviderSettings();
    providers.nvidia.apiKey = "nvapi-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ id: "z-ai/glm-5.1" }]
        })
      }))
    );

    const scan = await scanProviderImageModels(providers, "nvidia");
    const ids = scan.models.map((model) => model.id);

    expect(scan.status).toBe("ready");
    expect(ids.every((id) => id.toLowerCase().includes("flux"))).toBe(true);
    expect(ids).toContain("black-forest-labs/flux_1-schnell");
    expect(scan.selectedModel).toBe("flux.2-klein-4b");
  });

  it("uses the NVIDIA hosted GenAI path for FLUX.1-schnell with an optimized prompt", async () => {
    const providers = createDefaultProviderSettings();
    providers.nvidia.apiKey = "nvapi-test";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        artifacts: [{ base64: "aW1hZ2U=", mime_type: "image/png" }]
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImageFromPlan(providers, {
      provider: "nvidia",
      model: "black-forest-labs/flux_1-schnell",
      prompt: "generate an image of a dog"
    });
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { prompt: string; steps: number };

    expect(result.status).toBe("complete");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(requestBody.prompt).toContain("generate an image of a dog");
    expect(requestBody.prompt).toContain("Create one finished image");
    expect(requestBody.steps).toBe(4);
    expect(result.activity.model).toBe("black-forest-labs/flux_1-schnell");
    expect(result.activity.images).toHaveLength(1);
  });

  it("generates multiple images in one activity without exceeding the requested count", async () => {
    const providers = createDefaultProviderSettings();
    providers.nvidia.apiKey = "nvapi-test";
    providers.nvidia.imageModel = "black-forest-labs/flux_1-schnell";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        artifacts: [{ base64: "aW1hZ2U=", mime_type: "image/png" }]
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImageFromPlan(providers, {
      prompt: "generate three images of a dog",
      count: 3
    });

    expect(result.status).toBe("complete");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.activity.title).toBe("Generated 3 images");
    expect(result.activity.images).toHaveLength(3);
  });

  it("tries configured FLUX fallback models before returning a single concise error", async () => {
    const providers = createDefaultProviderSettings();
    providers.nvidia.apiKey = "nvapi-test";
    providers.nvidia.imageModel = "black-forest-labs/flux_1-schnell";
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => "404 page not found"
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImageFromPlan(providers, {
      prompt: "generate an image of a dog"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(result.status).toBe("error");
    expect(result.activity.provider).toBe("nvidia");
    expect(result.activity.error).toBe("Tried all configured NVIDIA FLUX image models. No image was generated.");
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(requestedUrls.some((url) => url.includes("api.openai.com"))).toBe(false);
  });

  it("ignores an assistant-specified OpenAI image provider and uses NVIDIA FLUX", async () => {
    const providers = createDefaultProviderSettings();
    providers.nvidia.apiKey = "nvapi-test";
    providers.nvidia.imageModel = "black-forest-labs/flux_1-schnell";
    providers.openai.apiKey = "openai-test";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        artifacts: [{ base64: "aW1hZ2U=", mime_type: "image/png" }]
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImageFromPlan(providers, {
      provider: "openai",
      prompt: "generate an image of a dog"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(result.status).toBe("complete");
    expect(result.activity.provider).toBe("nvidia");
    expect(requestedUrls.some((url) => url.includes("api.openai.com"))).toBe(false);
  });
});
