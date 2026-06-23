import { knownNvidiaImageModels } from "../shared/defaults";
import { normalizeProviderBaseUrl, providerIds, providerLabels } from "../shared/providers";
import type {
  BugReportResult,
  ProviderConfig,
  ProviderId,
  ProviderSettings,
  ProviderTestFailure,
  ProviderTestKind,
  ProviderTestProgress,
  ProviderTestRemoval,
  ProviderTestResult
} from "../shared/types";
import type { IssueReporter } from "./issueReporter";

type TestOutcome =
  | { ok: true; message: string; skipped?: boolean }
  | { ok: false; message: string; statusCode?: number; removable?: boolean; reportable?: boolean };

interface ChatModelOutcome {
  kind: "main-model" | "fallback-model";
  model: string;
  outcome: TestOutcome;
}

interface ImageModelOutcome {
  model: string;
  outcome: TestOutcome;
}

const providerTestTimeoutMs = 30_000;
const baseUrlTimeoutMs = 12_000;
const providerTestPrompt = "Reply with ok.";
const imageTestPrompt = "A simple black square centered on a plain white background.";

export async function runProviderTest(
  providers: ProviderSettings,
  issueReporter: IssueReporter,
  onProgress: (progress: ProviderTestProgress) => void
): Promise<ProviderTestResult> {
  const checkedAt = new Date().toISOString();
  const nextProviders = cloneProviders(providers);
  const total = countProviderTestSteps(providers);
  const failures: ProviderTestFailure[] = [];
  const removals: ProviderTestRemoval[] = [];
  let checked = 0;

  const emit = (message: string, provider?: ProviderId, kind?: ProviderTestKind): void => {
    onProgress({
      checked,
      total,
      percent: Math.min(100, Math.round((checked / Math.max(1, total)) * 100)),
      message,
      provider,
      kind
    });
  };

  emit("Starting provider health check.");

  for (const provider of providerIds) {
    const config = nextProviders[provider];
    const providerLabel = providerLabels[provider];
    const baseUrl = normalizeProviderBaseUrl(config.baseUrl);
    const chatOutcomes: ChatModelOutcome[] = [];
    const imageOutcomes: ImageModelOutcome[] = [];

    if (!config.enabled) {
      checked += 1;
      emit(`${providerLabel} is disabled.`, provider, "base-url");
      continue;
    }

    if (!baseUrl) {
      checked += 1;
      const failure = createFailure(provider, "base-url", "The provider base URL is not valid.", false);
      failures.push(failure);
      emit(failure.message, provider, "base-url");
      continue;
    }

    const baseOutcome = await testBareBaseUrl(provider, config, baseUrl);
    checked += 1;

    if (!baseOutcome.ok) {
      failures.push(createFailure(provider, "base-url", baseOutcome.message, false, undefined, baseOutcome.statusCode));
      emit(`${providerLabel} base URL failed.`, provider, "base-url");
      continue;
    }

    emit(`${providerLabel} base URL responded.`, provider, "base-url");

    if (!config.apiKey) {
      emit(`${providerLabel} needs an API key. Live model checks were skipped.`, provider, "main-model");
      continue;
    }

    for (const candidate of createChatModelCandidates(config)) {
      const kind = candidate === config.model ? "main-model" : "fallback-model";
      const outcome = await testChatModel(provider, config, candidate);
      chatOutcomes.push({ kind, model: candidate, outcome });
      checked += 1;

      if (!outcome.ok) {
        const removed = shouldRemoveModelFailure(outcome);
        failures.push(createFailure(provider, kind, outcome.message, removed, candidate, outcome.statusCode));
        emit(`${providerLabel} ${candidate} failed.`, provider, kind);
      } else {
        emit(`${providerLabel} ${candidate} passed.`, provider, kind);
      }
    }

    applyChatModelResults(provider, nextProviders, chatOutcomes, removals);

    if (provider !== "claude") {
      for (const imageModel of createImageModelCandidates(config)) {
        const outcome = await testImageModel(provider, config, imageModel);
        imageOutcomes.push({ model: imageModel, outcome });
        checked += 1;

        if (!outcome.ok) {
          const removed = shouldRemoveImageFailure(provider, outcome);
          failures.push(createFailure(provider, "image-model", outcome.message, removed, imageModel, outcome.statusCode));
          emit(`${providerLabel} image model ${imageModel} failed.`, provider, "image-model");
        } else {
          emit(`${providerLabel} image model ${imageModel} passed.`, provider, "image-model");
        }
      }

      applyImageModelResults(provider, nextProviders, imageOutcomes, removals);
    }
  }

  const reportableFailures = failures.filter(isReportableProviderTestFailure);
  const report =
    reportableFailures.length > 0 || removals.length > 0
      ? await reportProviderTest(issueReporter, checkedAt, nextProviders, reportableFailures, removals)
      : undefined;
  const status = removals.length > 0 ? "fixed" : failures.length > 0 ? "warning" : "ok";
  const message = createResultMessage(status, failures, removals, report);

  emit(message);

  return {
    checkedAt,
    failures,
    message,
    providers: nextProviders,
    removals,
    report,
    status
  };
}

function countProviderTestSteps(providers: ProviderSettings): number {
  return providerIds.reduce((total, provider) => {
    const config = providers[provider];

    if (!config.enabled) {
      return total + 1;
    }

    const modelCount = config.apiKey ? createChatModelCandidates(config).length : 0;
    const imageCount = config.apiKey && provider !== "claude" ? createImageModelCandidates(config).length : 0;
    return total + 1 + modelCount + imageCount;
  }, 0);
}

async function testBareBaseUrl(provider: ProviderId, config: ProviderConfig, baseUrl: string): Promise<TestOutcome> {
  try {
    const response = await fetch(baseUrl, {
      headers: createProviderHeaders(provider, config),
      signal: AbortSignal.timeout(baseUrlTimeoutMs)
    });

    if (response.status >= 500) {
      return { ok: false, statusCode: response.status, message: `${providerLabels[provider]} base URL returned status ${response.status}.` };
    }

    return { ok: true, message: `${providerLabels[provider]} base URL responded with status ${response.status}.` };
  } catch (error) {
    return { ok: false, message: `${providerLabels[provider]} base URL could not be reached. ${formatUnknownError(error)}` };
  }
}

async function testChatModel(provider: ProviderId, config: ProviderConfig, model: string): Promise<TestOutcome> {
  try {
    const response =
      provider === "claude"
        ? await fetch(providerUrl(config.baseUrl, "/messages"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": config.apiKey ?? "",
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model,
              max_tokens: 8,
              temperature: 0,
              system: "Provider health check.",
              messages: [{ role: "user", content: providerTestPrompt }]
            }),
            signal: AbortSignal.timeout(providerTestTimeoutMs)
          })
        : await fetch(providerUrl(config.baseUrl, "/chat/completions"), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: providerTestPrompt }],
              temperature: 0,
              max_tokens: 8
            }),
            signal: AbortSignal.timeout(providerTestTimeoutMs)
          });

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        message: `${providerLabels[provider]} model ${model} returned status ${response.status}. ${await safeProviderText(response)}`
      };
    }

    const text = await readChatResponseText(provider, response);
    return text ? { ok: true, message: `${model} responded.` } : { ok: false, message: `${model} returned no text.` };
  } catch (error) {
    return { ok: false, message: `${providerLabels[provider]} model ${model} could not be tested. ${formatUnknownError(error)}` };
  }
}

async function testImageModel(provider: "openai" | "nvidia", config: ProviderConfig, model: string): Promise<TestOutcome> {
  try {
    const response =
      provider === "nvidia" && nvidiaHostedImagePath(model)
        ? await fetch(nvidiaHostedGenAiUrl(config.baseUrl, nvidiaHostedImagePath(model)!), {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(createNvidiaImageBody(model, imageTestPrompt)),
            signal: AbortSignal.timeout(providerTestTimeoutMs)
          })
        : await fetch(providerUrl(config.baseUrl, "/images/generations"), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: normalizeNvidiaImageModel(model),
              prompt: imageTestPrompt,
              n: 1,
              size: "1024x1024"
            }),
            signal: AbortSignal.timeout(providerTestTimeoutMs)
          });

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        message: `${providerLabels[provider]} image model ${model} returned status ${response.status}. ${await safeProviderText(response)}`
      };
    }

    const json = (await response.json()) as {
      artifacts?: Array<{ base64?: string }>;
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const hasImage = Boolean(json.artifacts?.[0]?.base64 || json.data?.[0]?.b64_json || json.data?.[0]?.url);

    return hasImage ? { ok: true, message: `${model} generated an image.` } : { ok: false, message: `${model} returned no image.` };
  } catch (error) {
    return { ok: false, message: `${providerLabels[provider]} image model ${model} could not be tested. ${formatUnknownError(error)}` };
  }
}

function applyChatModelResults(
  provider: ProviderId,
  providers: ProviderSettings,
  outcomes: ChatModelOutcome[],
  removals: ProviderTestRemoval[]
): void {
  const config = providers[provider];
  const workingModels = outcomes.filter((outcome) => outcome.outcome.ok).map((outcome) => outcome.model);
  const removableFailures = new Set(outcomes.filter((outcome) => !outcome.outcome.ok && shouldRemoveModelFailure(outcome.outcome)).map((outcome) => outcome.model));
  const primaryFailed = removableFailures.has(config.model);

  if (primaryFailed) {
    const replacement = workingModels[0];

    if (replacement) {
      config.model = replacement;
      removals.push({
        provider,
        providerLabel: providerLabels[provider],
        kind: "main-model",
        model: outcomes[0]?.model,
        replacementModel: replacement,
        message: `${providerLabels[provider]} primary model was replaced with ${replacement}.`
      });
    } else {
      config.enabled = false;
      removals.push({
        provider,
        providerLabel: providerLabels[provider],
        kind: "provider",
        model: config.model,
        message: `${providerLabels[provider]} was disabled because no tested chat model worked.`
      });
    }
  }

  config.fallbackModels = (config.fallbackModels ?? []).filter((model) => {
    if (!removableFailures.has(model) || model === config.model) {
      return model !== config.model;
    }

    removals.push({
      provider,
      providerLabel: providerLabels[provider],
      kind: "fallback-model",
      model,
      message: `${providerLabels[provider]} fallback model ${model} was removed.`
    });
    return false;
  });
}

function applyImageModelResults(
  provider: "openai" | "nvidia",
  providers: ProviderSettings,
  outcomes: ImageModelOutcome[],
  removals: ProviderTestRemoval[]
): void {
  const config = providers[provider];
  const removableFailures = new Set(outcomes.filter((outcome) => !outcome.outcome.ok && shouldRemoveImageFailure(provider, outcome.outcome)).map((outcome) => outcome.model));
  const workingModels = outcomes.filter((outcome) => outcome.outcome.ok).map((outcome) => outcome.model);

  config.imageModels = (config.imageModels ?? []).filter((model) => {
    if (!removableFailures.has(model.id)) {
      return true;
    }

    removals.push({
      provider,
      providerLabel: providerLabels[provider],
      kind: "image-model",
      model: model.id,
      message: `${providerLabels[provider]} image model ${model.id} was removed.`
    });
    return false;
  });

  if (config.imageModel && removableFailures.has(config.imageModel)) {
    config.imageModel = workingModels.find((model) => !removableFailures.has(model)) ?? config.imageModels[0]?.id ?? "";
  }

  if (config.imageModelScan) {
    config.imageModelScan = {
      ...config.imageModelScan,
      status: config.imageModels.length > 0 ? "ready" : "none",
      message:
        config.imageModels.length > 0
          ? `${providerLabels[provider]} image models were checked.`
          : `${providerLabels[provider]} has no working image models after the provider health check.`,
      models: config.imageModels,
      selectedModel: config.imageModel || undefined,
      checkedAt: new Date().toISOString()
    };
  }
}

async function reportProviderTest(
  issueReporter: IssueReporter,
  checkedAt: string,
  providers: ProviderSettings,
  failures: ProviderTestFailure[],
  removals: ProviderTestRemoval[]
): Promise<BugReportResult> {
  const failureLines = failures.map((failure) =>
    [
      providerLabels[failure.provider],
      failure.kind,
      failure.model ? `model ${failure.model}` : "no model",
      failure.statusCode ? `status ${failure.statusCode}` : "no status",
      failure.removed ? "removed" : "kept",
      failure.message
    ].join(" | ")
  );
  const removalLines = removals.map((removal) =>
    [
      providerLabels[removal.provider],
      removal.kind,
      removal.model ? `model ${removal.model}` : "provider",
      removal.replacementModel ? `replacement ${removal.replacementModel}` : "",
      removal.message
    ]
      .filter(Boolean)
      .join(" | ")
  );

  return issueReporter.reportBug({
    area: "provider health check",
    title: removals.length > 0 ? "Provider health check removed failing models" : "Provider health check found provider issues",
    message: [
      `Provider health check completed at ${checkedAt}.`,
      "",
      "Removed items:",
      removalLines.length > 0 ? removalLines.join("\n") : "None",
      "",
      "Failures:",
      failureLines.length > 0 ? failureLines.join("\n") : "None",
      "",
      "Provider base URLs:",
      providerIds.map((provider) => `${providerLabels[provider]}: ${safeBaseUrlForReport(providers[provider].baseUrl)}`).join("\n")
    ].join("\n"),
    severity: removals.length > 0 ? "high" : "medium",
    source: "health-scan",
    metadata: {
      failedChecks: failures.length,
      removedItems: removals.length,
      activeProvider: providers.activeProvider,
      openaiModel: providers.openai.model,
      claudeModel: providers.claude.model,
      nvidiaModel: providers.nvidia.model,
      openaiFallbacks: (providers.openai.fallbackModels ?? []).join(", "),
      claudeFallbacks: (providers.claude.fallbackModels ?? []).join(", "),
      nvidiaFallbacks: (providers.nvidia.fallbackModels ?? []).join(", ")
    }
  });
}

function createResultMessage(
  status: ProviderTestResult["status"],
  failures: ProviderTestFailure[],
  removals: ProviderTestRemoval[],
  report: BugReportResult | undefined
): string {
  if (status === "ok") {
    return "Provider health check finished. No failing checks were found.";
  }

  const reportText = report ? ` ${formatReportStatus(report)}` : "";

  if (status === "fixed") {
    return `${removals.length} provider setting${removals.length === 1 ? "" : "s"} were removed or replaced after failed checks.${reportText}`;
  }

  return `${failures.length} provider check${failures.length === 1 ? "" : "s"} need attention.${reportText}`;
}

function formatReportStatus(report: BugReportResult): string {
  switch (report.status) {
    case "sent":
      return "A sanitized report was sent to the app developer.";
    case "queued":
      return "A sanitized report was saved and opened for the app developer.";
    case "skipped":
      return "The issue reporter skipped this duplicate report.";
    case "failed":
    default:
      return "The issue reporter could not send the report.";
  }
}

function createFailure(
  provider: ProviderId,
  kind: ProviderTestKind,
  message: string,
  removed: boolean,
  model?: string,
  statusCode?: number
): ProviderTestFailure {
  return {
    provider,
    providerLabel: providerLabels[provider],
    kind,
    model,
    statusCode,
    message: cleanText(message, 600),
    removed
  };
}

function createChatModelCandidates(config: ProviderConfig): string[] {
  return uniqueModels([config.model, ...(config.fallbackModels ?? [])]);
}

function createImageModelCandidates(config: ProviderConfig): string[] {
  return uniqueModels([config.imageModel ?? "", ...(config.imageModels ?? []).map((model) => model.id)]);
}

function uniqueModels(models: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const model of models) {
    const trimmed = model.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function shouldRemoveModelFailure(outcome: TestOutcome): boolean {
  if (outcome.ok) {
    return false;
  }

  if (typeof outcome.removable === "boolean") {
    return outcome.removable;
  }

  if (outcome.statusCode && [400, 404, 410, 422].includes(outcome.statusCode)) {
    return true;
  }

  return /\b(model|deployment|endpoint)\b.{0,80}\b(not found|missing|unavailable|does not exist|invalid|unsupported)\b/i.test(outcome.message);
}

function shouldRemoveImageFailure(provider: "openai" | "nvidia", outcome: TestOutcome): boolean {
  if (outcome.ok) {
    return false;
  }

  if (typeof outcome.removable === "boolean") {
    return outcome.removable;
  }

  return shouldRemoveModelFailure(outcome) || /returned no image|unsupported image/i.test(outcome.message);
}

function isReportableProviderTestFailure(failure: ProviderTestFailure): boolean {
  const combined = failure.message.toLowerCase();

  if (/needs an api key|disabled|skipped|could not be tested.*timeout|returned no text/.test(combined)) {
    return false;
  }

  if (failure.provider === "nvidia" && failure.kind === "image-model" && failure.statusCode === 404) {
    return false;
  }

  return failure.removed || failure.kind === "base-url" || failure.kind === "main-model";
}

function createProviderHeaders(provider: ProviderId, config: ProviderConfig): Record<string, string> {
  if (!config.apiKey) {
    return {};
  }

  if (provider === "claude") {
    return {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    };
  }

  return {
    Authorization: `Bearer ${config.apiKey}`
  };
}

async function readChatResponseText(provider: ProviderId, response: Response): Promise<string> {
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    content?: Array<{ text?: string }>;
  };

  if (provider === "claude") {
    return json.content?.map((part) => part.text).filter(Boolean).join("\n").trim() ?? "";
  }

  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function safeProviderText(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return cleanText(text, 500);
}

function providerUrl(baseUrl: string, pathname: string): string {
  const normalizedBaseUrl = normalizeProviderBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    throw new Error("Provider base URL must use https, or local http for development.");
  }

  const url = new URL(normalizedBaseUrl);
  const hasOnlyRootPath = url.pathname === "/" || url.pathname === "";

  if (hasOnlyRootPath && (url.hostname === "api.openai.com" || url.hostname === "integrate.api.nvidia.com")) {
    url.pathname = "/v1";
  }

  return `${url.toString().replace(/\/$/, "")}${pathname}`;
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

function nvidiaHostedImagePath(model: string): string | null {
  const known = new Map([
    ["black-forest-labs/flux.1-dev", "black-forest-labs/flux.1-dev"],
    ["black-forest-labs/flux_1-dev", "black-forest-labs/flux.1-dev"],
    ["black-forest-labs/flux.1-schnell", "black-forest-labs/flux.1-schnell"],
    ["black-forest-labs/flux_1-schnell", "black-forest-labs/flux.1-schnell"]
  ]);

  return known.get(model) ?? null;
}

function createNvidiaImageBody(model: string, prompt: string): Record<string, string | number> {
  if ((nvidiaHostedImagePath(model) ?? "").endsWith("flux.1-schnell")) {
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

function normalizeNvidiaImageModel(model: string): string {
  if (model === "black-forest-labs/flux_2-klein-4b") {
    return "flux.2-klein-4b";
  }

  return model;
}

function safeBaseUrlForReport(value: string): string {
  try {
    const url = new URL(normalizeProviderBaseUrl(value) ?? value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "Invalid URL";
  }
}

function formatUnknownError(error: unknown): string {
  return cleanText(error instanceof Error ? error.message : String(error), 500);
}

function cleanText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").replace(/\0/g, "").trim().slice(0, maxLength);
}

function cloneProviders(providers: ProviderSettings): ProviderSettings {
  const cloned = JSON.parse(JSON.stringify(providers)) as ProviderSettings;

  if (!cloned.nvidia.imageModels?.length) {
    cloned.nvidia.imageModels = knownNvidiaImageModels;
  }

  return cloned;
}
