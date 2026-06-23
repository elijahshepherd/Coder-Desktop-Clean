import type { AiFunctionalitySettings, AppState, MaintenanceState, PersonalizationSettings, ProviderConfig, ProviderSettings, SecuritySettings } from "./types";
import { appVersion } from "./version";

const nowImageScan = "1970-01-01T00:00:00.000Z";

export const knownNvidiaImageModels = [
  { id: "flux.2-klein-4b", label: "FLUX.2 klein 4B", provider: "nvidia" as const, source: "known" as const, quality: "fast" as const },
  { id: "black-forest-labs/flux_1-dev", label: "FLUX.1 dev", provider: "nvidia" as const, source: "known" as const, quality: "quality" as const },
  { id: "black-forest-labs/flux_1-schnell", label: "FLUX.1 schnell", provider: "nvidia" as const, source: "known" as const, quality: "fast" as const }
];

const baseNvidiaConfig: ProviderConfig = {
  enabled: true,
  model: "",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  imageModel: knownNvidiaImageModels[0].id,
  imageModels: knownNvidiaImageModels,
  imageModelScan: {
    provider: "nvidia",
    status: "needs-key",
    message: "Known NVIDIA image models are ready. Add an API key to scan availability for this account.",
    models: knownNvidiaImageModels,
    checkedAt: nowImageScan
  }
};

export const nvidiaDevelopmentPreset: ProviderConfig = {
  ...baseNvidiaConfig,
  model: "minimaxai/minimax-m3",
  fallbackModels: ["minimaxai/minimax-m2.7", "deepseek-ai/deepseek-v4-flash"],
  reasoningEffort: "high"
};

export const nvidiaEverydayPreset: ProviderConfig = {
  ...baseNvidiaConfig,
  model: "openai/gpt-oss-120b",
  fallbackModels: ["stepfun-ai/step-3.5-flash", "openai/gpt-oss-20b"],
  reasoningEffort: "medium"
};

export const defaultProviderSettings: ProviderSettings = {
  activeProvider: "openai",
  openai: {
    enabled: true,
    model: "gpt-5-mini",
    fallbackModels: ["gpt-4.1-mini", "gpt-4o-mini"],
    reasoningEffort: "medium",
    baseUrl: "https://api.openai.com/v1",
    imageModel: "",
    imageModels: [],
    imageModelScan: {
      provider: "openai",
      status: "none",
      message: "Image generation is available through NVIDIA FLUX models.",
      models: [],
      checkedAt: nowImageScan
    }
  },
  claude: {
    enabled: true,
    model: "claude-haiku-4-5",
    fallbackModels: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
    reasoningEffort: "none",
    baseUrl: "https://api.anthropic.com/v1",
    imageModel: "",
    imageModels: [],
    imageModelScan: {
      provider: "claude",
      status: "none",
      message: "Claude can inspect images, but this provider does not expose native image generation here.",
      models: [],
      checkedAt: nowImageScan
    }
  },
  nvidia: {
    enabled: true,
    model: "z-ai/glm-5.1",
    fallbackModels: ["mistralai/mistral-nemotron", "openai/gpt-oss-120b", "deepseek-ai/deepseek-v4-flash"],
    reasoningEffort: "high",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    imageModel: knownNvidiaImageModels[0].id,
    imageModels: knownNvidiaImageModels,
    imageModelScan: {
      provider: "nvidia",
      status: "needs-key",
      message: "Known NVIDIA image models are ready. Add an API key to scan availability for this account.",
      models: knownNvidiaImageModels,
      checkedAt: nowImageScan
    }
  }
};

export const defaultSecuritySettings: SecuritySettings = {
  accessMode: "approve",
  allowFileRead: true,
  allowFileEdit: true,
  allowShellExecute: true,
  allowInternetAccess: true,
  requirePermissionPrompts: true,
  autoContinueOnProviderError: true,
  showMessageIdentity: false
};

export const defaultPersonalizationSettings: PersonalizationSettings = {
  theme: "light",
  accentTone: "graphite",
  customAccentColor: "#2563eb",
  completionAnimation: true,
  completionNotifications: true,
  nvidiaPreset: "manual",
  autonomousImageGeneration: true,
  autoAcceptImageGeneration: false,
  autoUpscaleGeneratedImages: false,
  autoCollapseImageCards: true,
  clearLocalDataOnVersionUpdate: false
};

export const defaultAiFunctionalitySettings: AiFunctionalitySettings = {
  maxLetMeKnows: 0
};

export const createDefaultProviderSettings = (): ProviderSettings => ({
  activeProvider: defaultProviderSettings.activeProvider,
  openai: JSON.parse(JSON.stringify(defaultProviderSettings.openai)),
  claude: JSON.parse(JSON.stringify(defaultProviderSettings.claude)),
  nvidia: JSON.parse(JSON.stringify(defaultProviderSettings.nvidia))
});

export const createDefaultSecuritySettings = (): SecuritySettings => ({
  ...defaultSecuritySettings
});

export const createDefaultPersonalizationSettings = (): PersonalizationSettings => ({
  ...defaultPersonalizationSettings
});

export const createDefaultAiFunctionalitySettings = (): AiFunctionalitySettings => ({
  ...defaultAiFunctionalitySettings
});

export const createDefaultState = (): AppState => {
  const now = new Date().toISOString();

  return {
    activeChatId: null,
    hasSeenStarterCard: false,
    lastVersion: appVersion,
    maintenance: null,
    providers: createDefaultProviderSettings(),
    personalization: createDefaultPersonalizationSettings(),
    aiFunctionality: createDefaultAiFunctionalitySettings(),
    profile: {
      onboardingCompleted: true,
      preferredName: "",
      workFocus: "",
      interests: "",
      styleNotes: "",
      updatedAt: now
    },
    security: createDefaultSecuritySettings(),
    workspace: {
      root: null,
      recentRoots: []
    },
    chats: []
  };
};
