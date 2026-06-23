import { normalizeProviderBaseUrl, providerLabels } from "../shared/providers";
import { knownNvidiaImageModels } from "../shared/defaults";
import type {
  ChatMessage,
  GeneratedImage,
  ImageGenerationActivity,
  ImageModelOption,
  ImageModelScanResult,
  ProviderId,
  ProviderSettings
} from "../shared/types";

const scanTimeoutMs = 20_000;
const imageTimeoutMs = 45_000;
const maxImagesPerRequest = 3;
const openAiKnownImageModels: ImageModelOption[] = [];
const nvidiaKnownImageModels: ImageModelOption[] = knownNvidiaImageModels;
const nvidiaHostedGenAiModels = new Map([
  ["black-forest-labs/flux.1-dev", "black-forest-labs/flux.1-dev"],
  ["black-forest-labs/flux_1-dev", "black-forest-labs/flux.1-dev"],
  ["black-forest-labs/flux.1-schnell", "black-forest-labs/flux.1-schnell"],
  ["black-forest-labs/flux_1-schnell", "black-forest-labs/flux.1-schnell"]
]);

export interface ImageGenerationPlan {
  prompt: string;
  provider?: ProviderId;
  model?: string;
  count?: number;
}

export interface ImageGenerationResult {
  activity: ImageGenerationActivity;
  status: "complete" | "error";
}

class ImageProviderRequestError extends Error {
  constructor(
    readonly provider: ProviderId,
    readonly model: string,
    readonly statusCode: number,
    readonly responseText: string,
    readonly requestUrl: string
  ) {
    super(`${providerLabels[provider]} image request for ${model} returned status ${statusCode}.`);
    this.name = "ImageProviderRequestError";
  }
}

export async function scanProviderImageModels(providers: ProviderSettings, provider: ProviderId): Promise<ImageModelScanResult> {
  const checkedAt = new Date().toISOString();
  const config = providers[provider];

  if (!config.enabled) {
    return {
      provider,
      status: "needs-key",
      message: `${providerLabels[provider]} is disabled.`,
      models: [],
      checkedAt
    };
  }

  if (!config.apiKey) {
    const knownModels = provider === "nvidia" ? nvidiaKnownImageModels : [];

    return {
      provider,
      status: "needs-key",
      message: `${providerLabels[provider]} needs an API key before image models can be scanned.`,
      models: knownModels,
      selectedModel: knownModels[0]?.id,
      checkedAt
    };
  }

  if (provider !== "nvidia") {
    return {
      provider,
      status: "none",
      message: "Image generation is available through NVIDIA FLUX models.",
      models: [],
      checkedAt
    };
  }

  const baseUrl = normalizeProviderBaseUrl(config.baseUrl);

  if (!baseUrl) {
    return {
      provider,
      status: "error",
      message: `${providerLabels[provider]} base URL is not valid.`,
      models: [],
      checkedAt
    };
  }

  try {
    const response = await fetch(providerUrl(baseUrl, "/models"), {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(scanTimeoutMs)
    });

    if (!response.ok) {
      return fallbackScan(provider, checkedAt, `${providerLabels[provider]} model scan returned status ${response.status}.`);
    }

    const json = (await response.json()) as { data?: Array<{ id?: string; object?: string }> };
    const ids = Array.isArray(json.data) ? json.data.map((item) => item.id).filter((id): id is string => Boolean(id)) : [];
    const models = ids.map((id) => createImageModelOption(provider, id)).filter((model): model is ImageModelOption => Boolean(model));

    if (models.length === 0) {
      return fallbackScan(provider, checkedAt, `No image models for this provider.`);
    }

    const selectedModel = pickBestImageModel(provider, models);
    return {
      provider,
      status: "ready",
      message: `${providerLabels[provider]} image models were scanned.`,
      models,
      selectedModel,
      checkedAt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fallbackScan(provider, checkedAt, `${providerLabels[provider]} image scan failed. ${message}`);
  }
}

export function detectImageGenerationPlan(content: string): ImageGenerationPlan | null {
  const normalized = content.trim();

  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const looksLikeCapabilityQuestion =
    /^(can|could|do|does|are|is)\b.{0,80}\b(create|generate|make|draw|design|render)\b.{0,40}\b(images?|pictures?|art|visuals?)\??$/i.test(
      normalized
    ) && !/\b(of|for|showing|with|featuring|depicting)\b/i.test(normalized);

  if (looksLikeCapabilityQuestion) {
    return null;
  }

  const asksForImage =
    /\b(generat(?:e|ed|ing)?|genrat(?:e|ed|ing)?|creat(?:e|ed|ing)?|make|draw|design|render)\b/.test(lower) &&
    /\b(image|images|picture|pictures|photo|photos|iameg|imgae|iamge|img|mockup|icon|logo|illustration|concept art|visual|wallpaper|asset)\b/.test(
      lower
    );

  if (!asksForImage) {
    return null;
  }

  return {
      prompt: normalized,
      count: inferImageCount(normalized)
  };
}

export function detectImageRetryPlan(content: string, messages: ChatMessage[]): ImageGenerationPlan | null {
  if (!/^\s*(try again|retry|rerun|run it again|generate again|attempt again|one more time)\s*[.!?]*\s*$/i.test(content)) {
    return null;
  }

  const previousImage = [...messages].reverse().find((message) => message.imageGeneration)?.imageGeneration;

  if (!previousImage?.prompt) {
    return null;
  }

  return {
    prompt: previousImage.prompt,
    provider: previousImage.provider,
    model: previousImage.model && previousImage.model !== "No image model selected" ? previousImage.model : undefined,
    count: previousImage.images?.length ?? (previousImage.image ? 1 : undefined)
  };
}

export function parseImageGenerationRequests(content: string): ImageGenerationPlan[] {
  const matches = content.matchAll(/<coder-image>\s*({[\s\S]*?})\s*<\/coder-image>/gi);
  const requests: ImageGenerationPlan[] = [];

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      const prompt = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";

      if (!prompt) {
        continue;
      }

      requests.push({
        prompt: prompt.slice(0, 2_000),
        provider: readProviderId(parsed.provider),
        model: typeof parsed.model === "string" ? parsed.model.trim().slice(0, 160) : undefined,
        count: readImageCount(parsed.count)
      });
    } catch {
      continue;
    }
  }

  return requests;
}

export function stripImageGenerationRequests(content: string): string {
  return content.replace(/<coder-image>[\s\S]*?<\/coder-image>/gi, "").trim();
}

export function createImageGenerationActivity(providers: ProviderSettings, plan: ImageGenerationPlan): ImageGenerationActivity {
  const provider = resolveImageProvider(providers, plan);
  const config = providers[provider];
  const model = plan.model || config.imageModel || config.imageModels?.[0]?.id || "";
  const count = clampImageCount(plan.count);

  return {
    kind: "image-generation",
    title: count > 1 ? `Generating ${count} images` : "Generating image",
    description: count > 1 ? `Creating ${count} images from the chat prompt.` : "Creating an image from the chat prompt.",
    group: "Images",
    provider,
    providerLabel: providerLabels[provider],
    model: model || "No image model selected",
    prompt: plan.prompt,
    metrics: [{ label: "Images", value: String(count) }]
  };
}

export async function generateImageFromPlan(
  providers: ProviderSettings,
  plan: ImageGenerationPlan,
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  const primaryProvider = resolveImageProvider(providers, plan);
  const providerOrder = createImageProviderOrder(primaryProvider);
  const requestedCount = clampImageCount(plan.count);
  let lastError = "No image models were available.";
  let primaryProviderError = "";
  let firstRequestError = "";
  let firstConfigurationError = "";
  const recordFailure = (provider: ProviderId, message: string, kind: "configuration" | "request") => {
    if (provider === primaryProvider && !primaryProviderError) {
      primaryProviderError = message;
    }

    if (kind === "request" && !firstRequestError) {
      firstRequestError = message;
    }

    if (kind === "configuration" && !firstConfigurationError) {
      firstConfigurationError = message;
    }

    lastError = message;
  };

  for (const provider of providerOrder) {
    const config = providers[provider];
    const requestedModel = plan.model || config.imageModel || pickBestImageModel(provider, config.imageModels ?? []);
    const activity = createImageGenerationActivity(providers, { ...plan, provider, model: requestedModel });

    if (!config.enabled) {
      recordFailure(provider, `${providerLabels[provider]} is disabled.`, "configuration");
      continue;
    }

    if (!config.apiKey) {
      recordFailure(provider, `${providerLabels[provider]} needs an API key before images can be generated.`, "configuration");
      continue;
    }

    const candidateModels = createImageModelCandidates(provider, requestedModel, config.imageModels ?? []);

    if (provider !== "nvidia") {
      recordFailure(provider, "Image generation is available through NVIDIA FLUX models.", "configuration");
      continue;
    }

    if (!requestedModel || candidateModels.length === 0) {
      recordFailure(provider, `No image models for ${providerLabels[provider]}.`, "configuration");
      continue;
    }

    const images: GeneratedImage[] = [];
    let selectedModel = requestedModel;
    let usedFallback = false;

    for (let imageIndex = 0; imageIndex < requestedCount; imageIndex += 1) {
      const candidateModels = createImageModelCandidates(provider, selectedModel, config.imageModels ?? []);
      let generated: { image: GeneratedImage; model: string } | null = null;

      for (const candidateModel of candidateModels) {
        try {
          const prompt = createOptimizedImagePrompt(plan.prompt, imageIndex, requestedCount);
          const image =
            provider === "nvidia"
              ? await requestNvidiaImage(config.baseUrl, config.apiKey, candidateModel, prompt, signal)
              : await requestOpenAiCompatibleImage(provider, config.baseUrl, config.apiKey, candidateModel, prompt, signal);
          generated = { image: { ...image, model: candidateModel }, model: candidateModel };
          break;
        } catch (error) {
          recordFailure(provider, formatImageRequestError(provider, candidateModel, error), "request");
          usedFallback = usedFallback || candidateModel !== requestedModel;

          if (isAuthenticationImageError(error)) {
            break;
          }
        }
      }

      if (!generated) {
        break;
      }

      images.push(generated.image);
      selectedModel = generated.model;
      usedFallback = usedFallback || generated.model !== requestedModel;
    }

    if (images.length === requestedCount) {
      return {
        status: "complete",
        activity: {
          ...activity,
          title: requestedCount > 1 ? `Generated ${requestedCount} images` : "Generated image",
          description: usedFallback
            ? "The selected image model was unavailable, so Coder Desktop used a compatible FLUX fallback."
            : "The image generation finished.",
          model: selectedModel,
          image: images[0],
          images,
          metrics: [
            { label: "Images", value: String(images.length) },
            { label: "Image model", value: selectedModel }
          ]
        }
      };
    }
  }

  const activity = createImageGenerationActivity(providers, { ...plan, provider: primaryProvider });
  return {
    status: "error",
    activity: {
      ...activity,
      title: "Image generation failed",
      description: "Coder Desktop tried the configured FLUX image models and could not create the requested image.",
      error: createConciseImageError(primaryProviderError || firstRequestError || firstConfigurationError || lastError),
      metrics: [{ label: "Status", value: "Failed", tone: "danger" }]
    }
  };
}

function fallbackScan(provider: ProviderId, checkedAt: string, message: string): ImageModelScanResult {
  if (provider === "openai") {
    return {
      provider,
      status: "none",
      message: "Image generation is available through NVIDIA FLUX models.",
      models: [],
      checkedAt
    };
  }

  if (provider === "nvidia") {
    return {
      provider,
      status: "ready",
      message: `${message} Known NVIDIA image models were added.`,
      models: nvidiaKnownImageModels,
      selectedModel: nvidiaKnownImageModels[0]?.id,
      checkedAt
    };
  }

  return {
    provider,
    status: message.toLowerCase().includes("no image models") ? "none" : "error",
    message,
    models: [],
    checkedAt
  };
}

async function requestOpenAiCompatibleImage(
  provider: ProviderId,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal?: AbortSignal
): Promise<GeneratedImage> {
  const normalizedBaseUrl = normalizeProviderBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    throw new Error("The provider base URL is not valid.");
  }

  const requestUrl = providerUrl(normalizedBaseUrl, "/images/generations");
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1024x1024"
    }),
    signal: withImageTimeoutSignal(signal)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ImageProviderRequestError(provider, model, response.status, text.slice(0, 500), requestUrl);
  }

  const json = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };
  const first = json.data?.[0];

  if (!first) {
    throw new Error("The image provider returned no image.");
  }

  if (first.b64_json) {
    return {
      mimeType: "image/png",
      dataUrl: `data:image/png;base64,${first.b64_json}`,
      revisedPrompt: first.revised_prompt
    };
  }

  if (first.url) {
    return {
      mimeType: "image/png",
      url: first.url,
      revisedPrompt: first.revised_prompt
    };
  }

  throw new Error("The image provider returned an unsupported image format.");
}

async function requestNvidiaImage(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal?: AbortSignal
): Promise<GeneratedImage> {
  const hostedModelPath = nvidiaHostedGenAiModels.get(model);

  if (!hostedModelPath) {
    return requestOpenAiCompatibleImage("nvidia", baseUrl, apiKey, normalizeNvidiaOpenAiImageModel(model), prompt, signal);
  }

  const requestUrl = nvidiaHostedGenAiUrl(baseUrl, hostedModelPath);
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(createNvidiaHostedImageBody(hostedModelPath, prompt)),
    signal: withImageTimeoutSignal(signal)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ImageProviderRequestError("nvidia", model, response.status, text.slice(0, 500), requestUrl);
  }

  const json = (await response.json()) as {
    artifacts?: Array<{ base64?: string; mime_type?: string; finish_reason?: string }>;
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };
  const artifact = json.artifacts?.[0];

  if (artifact?.base64) {
    return {
      mimeType: artifact.mime_type || "image/png",
      dataUrl: `data:${artifact.mime_type || "image/png"};base64,${artifact.base64}`
    };
  }

  const first = json.data?.[0];

  if (first?.b64_json) {
    return {
      mimeType: "image/png",
      dataUrl: `data:image/png;base64,${first.b64_json}`,
      revisedPrompt: first.revised_prompt
    };
  }

  if (first?.url) {
    return {
      mimeType: "image/png",
      url: first.url,
      revisedPrompt: first.revised_prompt
    };
  }

  throw new Error("NVIDIA returned no image data.");
}

function createImageModelOption(provider: ProviderId, id: string): ImageModelOption | null {
  if (provider !== "nvidia" || !isFluxImageModel(id)) {
    return null;
  }

  return {
    id,
    label: formatModelLabel(id),
    provider,
    source: "api",
    quality: inferImageQuality(id)
  };
}

function pickBestImageModel(provider: ProviderId, models: ImageModelOption[]): string {
  if (models.length === 0) {
    return "";
  }

  const priorities =
    provider === "openai"
      ? []
      : ["flux.2-klein", "flux_2-klein", "black-forest-labs/flux_1-dev", "black-forest-labs/flux.1-dev", "flux_1-schnell", "flux.1-schnell", "flux"];

  for (const priority of priorities) {
    const match = models.find((model) => model.id.toLowerCase().includes(priority));

    if (match) {
      return match.id;
    }
  }

  return models[0].id;
}

function createImageModelCandidates(provider: ProviderId, requestedModel: string, models: ImageModelOption[]): string[] {
  const knownModels = provider === "openai" ? openAiKnownImageModels : provider === "nvidia" ? nvidiaKnownImageModels : [];
  const priorities =
    provider === "openai"
      ? []
      : [
          "flux.2-klein-4b",
          "black-forest-labs/flux_1-dev",
          "black-forest-labs/flux.1-dev",
          "black-forest-labs/flux_1-schnell",
          "black-forest-labs/flux.1-schnell"
        ];
  const sourceIds = [requestedModel, ...models.map((model) => model.id), ...knownModels.map((model) => model.id), ...priorities];
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const id of sourceIds) {
    const normalized = id.trim();

    if (!normalized || seen.has(normalized) || !isFluxImageModel(normalized)) {
      continue;
    }

    seen.add(normalized);
    candidates.push(normalized);
  }

  return candidates;
}

function createImageProviderOrder(primaryProvider: ProviderId): ProviderId[] {
  return [primaryProvider];
}

function resolveImageProvider(providers: ProviderSettings, plan: ImageGenerationPlan): ProviderId {
  if (providers.nvidia.enabled) {
    return "nvidia";
  }

  return plan.provider ?? providers.activeProvider;
}

function clampImageCount(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(maxImagesPerRequest, Math.max(1, Math.round(value ?? 1)));
}

function readImageCount(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? clampImageCount(numeric) : undefined;
}

function inferImageCount(content: string): number {
  const lower = content.toLowerCase();
  const numericMatch = /\b([1-3])\s+(?:images?|pictures?|photos?|variations?|options?)\b/.exec(lower);

  if (numericMatch) {
    return clampImageCount(Number(numericMatch[1]));
  }

  if (/\b(two|couple|pair)\s+(?:images?|pictures?|photos?|variations?|options?)\b/.test(lower)) {
    return 2;
  }

  if (/\b(three|few)\s+(?:images?|pictures?|photos?|variations?|options?)\b/.test(lower)) {
    return 3;
  }

  return 1;
}

function createOptimizedImagePrompt(prompt: string, index: number, count: number): string {
  const variation = count > 1 ? ` This is image ${index + 1} of ${count}; keep the subject consistent but vary composition, framing, or visual emphasis.` : "";

  return [
    "Create one finished image from this request.",
    "Use a clear subject, intentional composition, readable silhouettes, coherent lighting, and polished visual detail.",
    "Avoid extra text, watermarks, UI chrome, duplicated subjects, malformed hands, and clutter unless the user explicitly requested them.",
    `${prompt.trim()}${variation}`
  ].join(" ");
}

function createConciseImageError(message: string): string {
  if (/api key|disabled|no image models/i.test(message)) {
    return message.replace(/\s+/g, " ").trim();
  }

  return "Tried all configured NVIDIA FLUX image models. No image was generated.";
}

function isFluxImageModel(id: string): boolean {
  return /\bflux\b|flux[._-]?\d|black-forest-labs\/flux/i.test(id);
}

function inferImageQuality(id: string): ImageModelOption["quality"] {
  const lower = id.toLowerCase();

  if (/(mini|fast|turbo|lite)/.test(lower)) {
    return "fast";
  }

  if (/(1\.5|pro|ultra|quality|dall-e-3)/.test(lower)) {
    return "quality";
  }

  return "balanced";
}

function formatModelLabel(id: string): string {
  return id
    .split(/[/:_-]+/g)
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join(" ");
}

function createNvidiaHostedImageBody(modelPath: string, prompt: string): Record<string, string | number> {
  if (modelPath.endsWith("flux.1-schnell")) {
    return {
      prompt,
      height: 1024,
      width: 1024,
      cfg_scale: 0,
      mode: "base",
      samples: 1,
      seed: 0,
      steps: 4
    };
  }

  return {
    prompt,
    height: 1024,
    width: 1024,
    cfg_scale: 5,
    mode: "base",
    samples: 1,
    seed: 0,
    steps: 50
  };
}

function normalizeNvidiaOpenAiImageModel(model: string): string {
  if (model === "black-forest-labs/flux_2-klein-4b") {
    return "flux.2-klein-4b";
  }

  return model;
}

function nvidiaHostedGenAiUrl(baseUrl: string, modelPath: string): string {
  const normalizedBaseUrl = normalizeProviderBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    throw new Error("The NVIDIA base URL is not valid.");
  }

  const parsedBase = new URL(normalizedBaseUrl);

  if (parsedBase.hostname === "integrate.api.nvidia.com" || parsedBase.hostname === "ai.api.nvidia.com") {
    return `https://ai.api.nvidia.com/v1/genai/${modelPath}`;
  }

  return providerUrl(normalizedBaseUrl, "/infer");
}

function providerUrl(baseUrl: string, pathname: string): string {
  const url = new URL(baseUrl);
  const hasOnlyRootPath = url.pathname === "/" || url.pathname === "";

  if (hasOnlyRootPath && needsVersionedProviderPath(url.hostname)) {
    url.pathname = "/v1";
  }

  return `${url.toString().replace(/\/$/, "")}${pathname}`;
}

function readProviderId(value: unknown): ProviderId | undefined {
  return value === "openai" || value === "claude" || value === "nvidia" ? value : undefined;
}

function needsVersionedProviderPath(hostname: string): boolean {
  return hostname === "api.openai.com" || hostname === "integrate.api.nvidia.com";
}

function withImageTimeoutSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(imageTimeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function formatImageRequestError(provider: ProviderId, model: string, error: unknown): string {
  if (error instanceof ImageProviderRequestError) {
    const detail = error.responseText.replace(/\s+/g, " ").trim();
    const baseMessage = `${providerLabels[provider]} image model ${model} failed with status ${error.statusCode}.`;

    if (error.statusCode === 404) {
      return `${baseMessage} Coder Desktop tried the Image API endpoint and will try compatible fallback image models. ${detail}`;
    }

    return detail ? `${baseMessage} ${detail}` : baseMessage;
  }

  return error instanceof Error ? error.message : String(error);
}

function isAuthenticationImageError(error: unknown): boolean {
  return error instanceof ImageProviderRequestError && (error.statusCode === 401 || error.statusCode === 403);
}
