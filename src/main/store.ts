import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createDefaultState,
  defaultAiFunctionalitySettings,
  defaultPersonalizationSettings,
  defaultProviderSettings,
  defaultSecuritySettings
} from "../shared/defaults";
import { isProviderId, providerIds, sanitizeProviderBaseUrl, sanitizeText } from "../shared/providers";
import type {
  ApprovalRequest,
  AiFunctionalitySettings,
  AccentTone,
  AppState,
  ChatMessage,
  ChatThread,
  ImageGenerationActivity,
  ImageModelOption,
  ImageModelScanResult,
  MaintenanceState,
  MessageFeedback,
  NidiaPresetId,
  ProviderConfig,
  ProviderId,
  ProviderError,
  ProviderSettings,
  PersonalizationSettings,
  ReasoningEffort,
  QuestionSet,
  SecuritySettings,
  ToolActivity,
  TodoProgress,
  UserProfile
} from "../shared/types";
import { formatToolActivityContent } from "./workspaceToolRequests";
import { SecretsVault } from "./secrets";
import { appVersion } from "../shared/version";

type StoredState = Omit<AppState, "providers"> & {
  providers: ProviderSettings;
};

type ProviderConfigInput = Partial<ProviderConfig> | undefined;
type ProviderSettingsInput = Partial<Record<ProviderId, ProviderConfigInput>> & {
  activeProvider?: unknown;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const maxMessageLength = 32_000;
const maxFallbackModels = 3;
const maxImageModels = 12;

export class DesktopStore {
  private readonly statePath: string;
  private state: StoredState;

  private constructor(
    private readonly dataPath: string,
    private readonly secrets: SecretsVault,
    initialState: StoredState
  ) {
    this.statePath = path.join(dataPath, "state.json");
    this.state = initialState;
  }

  static async create(userDataPath: string): Promise<DesktopStore> {
    const dataPath = path.join(userDataPath, "coder-desktop-data");
    await mkdir(dataPath, { recursive: true });
    const secrets = await SecretsVault.create(dataPath);
    const statePath = path.join(dataPath, "state.json");

    let state = createDefaultState() as StoredState;
    let loadedExistingState = false;
    let existingStateHadProfile = false;
    let existingStateHadStarterFlag = false;

    try {
      const storedState = JSON.parse(await readFile(statePath, "utf8")) as StoredState;
      loadedExistingState = true;
      existingStateHadProfile = isRecord((storedState as { profile?: unknown }).profile);
      existingStateHadStarterFlag = typeof (storedState as { hasSeenStarterCard?: unknown }).hasSeenStarterCard === "boolean";
      state = {
        ...state,
        ...storedState
      };
    } catch {
      await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
    }

    state.providers = {
      ...defaultProviderSettings,
      ...state.providers,
      openai: { ...defaultProviderSettings.openai, ...state.providers?.openai },
      claude: { ...defaultProviderSettings.claude, ...state.providers?.claude },
      nvidia: { ...defaultProviderSettings.nvidia, ...state.providers?.nvidia }
    };
    state.providers = normalizeExclusiveImageModelSelection(state.providers);
    state.security = sanitizeSecuritySettings(state.security);
    state.personalization = sanitizePersonalizationSettings(state.personalization);
    state.aiFunctionality = sanitizeAiFunctionalitySettings(state.aiFunctionality);
    state.profile = sanitizeUserProfile(
      loadedExistingState && !existingStateHadProfile ? { onboardingCompleted: true, updatedAt: new Date().toISOString() } : state.profile
    );
    state.hasSeenStarterCard = loadedExistingState && !existingStateHadStarterFlag ? true : Boolean(state.hasSeenStarterCard);
    state = removeLegacyWelcomeChat(state);

    const storedVersion = typeof state.lastVersion === "string" ? state.lastVersion : "";
    if (storedVersion && storedVersion !== appVersion) {
      const personalization = sanitizePersonalizationSettings(state.personalization);
      if (personalization.clearLocalDataOnVersionUpdate) {
        state = createDefaultState() as StoredState;
      }
    }
    state.lastVersion = appVersion;

    return new DesktopStore(dataPath, secrets, state);
  }

  async getPublicState(): Promise<AppState> {
    const publicState = clone(this.state);

    for (const provider of providerIds) {
      publicState.providers[provider].apiKey = "";
      publicState.providers[provider].hasApiKey = await this.secrets.has(provider);
    }

    return publicState;
  }

  async getProvidersWithSecrets(): Promise<ProviderSettings> {
    const providers = clone(this.state.providers);

    for (const provider of providerIds) {
      providers[provider].apiKey = await this.secrets.read(provider);
    }

    return providers;
  }

  async createChat(): Promise<AppState> {
    const now = new Date().toISOString();
    const chat: ChatThread = {
      id: createId("chat"),
      title: "New chat",
      provider: this.state.providers.activeProvider,
      messages: [],
      createdAt: now,
      updatedAt: now
    };

    this.state.chats = [chat, ...this.state.chats];
    this.state.activeChatId = chat.id;
    this.state.hasSeenStarterCard = true;
    await this.save();
    return this.getPublicState();
  }

  async markStarterCardSeen(): Promise<AppState> {
    if (!this.state.hasSeenStarterCard) {
      this.state.hasSeenStarterCard = true;
      await this.save();
    }

    return this.getPublicState();
  }

  async deleteChat(chatId: string): Promise<AppState> {
    const existingIndex = this.state.chats.findIndex((chat) => chat.id === chatId);

    if (existingIndex < 0) {
      return this.getPublicState();
    }

    this.state.chats = this.state.chats.filter((chat) => chat.id !== chatId);

    if (this.state.activeChatId === chatId) {
      this.state.activeChatId = this.state.chats[Math.max(0, existingIndex - 1)]?.id ?? this.state.chats[0]?.id ?? null;
    }

    await this.save();
    return this.getPublicState();
  }

  async setActiveChat(chatId: string): Promise<AppState> {
    if (this.state.chats.some((chat) => chat.id === chatId)) {
      this.state.activeChatId = chatId;
      await this.save();
    }

    return this.getPublicState();
  }

  getChat(chatId: string): ChatThread | undefined {
    return this.state.chats.find((chat) => chat.id === chatId);
  }

  getActiveChatId(): string | null {
    return this.state.activeChatId;
  }

  async addUserMessage(chatId: string, content: string): Promise<ChatThread> {
    const chat = this.requireChat(chatId);
    const safeContent = this.normalizeMessageContent(content);
    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: createId("msg"),
      role: "user",
      content: safeContent,
      createdAt: now,
      status: "complete"
    };

    chat.messages.push(message);
    chat.provider = this.state.providers.activeProvider;
    chat.updatedAt = now;

    if (chat.title === "New chat") {
      chat.title = this.createChatTitle(safeContent);
    }

    await this.save();
    return clone(chat);
  }

  async addAssistantMessage(
    chatId: string,
    content: string,
    status: ChatMessage["status"] = "complete",
    durationMs?: number
  ): Promise<AppState> {
    const chat = this.requireChat(chatId);
    const now = new Date().toISOString();

    chat.messages.push({
      id: createId("msg"),
      role: "assistant",
      content,
      createdAt: now,
      status,
      durationMs
    });
    chat.updatedAt = now;

    await this.save();
    return this.getPublicState();
  }

  async upsertTodoProgressMessage(chatId: string, progress: TodoProgress): Promise<AppState> {
    const chat = this.requireChat(chatId);
    const now = new Date().toISOString();
    const latestProgressMessage = [...chat.messages].reverse().find((message) => message.todoProgress);
    const normalizedProgress = {
      ...progress,
      updatedAt: now
    };

    if (latestProgressMessage?.todoProgress && latestProgressMessage.status !== "complete") {
      latestProgressMessage.todoProgress = normalizedProgress;
      latestProgressMessage.content = formatTodoProgressContent(normalizedProgress);
      latestProgressMessage.status = progress.items.every((item) => item.status === "done") ? "complete" : "thinking";
      latestProgressMessage.createdAt = latestProgressMessage.createdAt || now;
    } else {
      chat.messages.push({
        id: createId("progress"),
        role: "assistant",
        content: formatTodoProgressContent(normalizedProgress),
        createdAt: now,
        status: progress.items.every((item) => item.status === "done") ? "complete" : "thinking",
        todoProgress: normalizedProgress
      });
    }

    chat.updatedAt = now;
    await this.save();
    return this.getPublicState();
  }

  async addQuestionSetMessage(chatId: string, questionSet: QuestionSet): Promise<AppState> {
    const chat = this.requireChat(chatId);
    const now = new Date().toISOString();
    const normalizedQuestionSet = {
      ...questionSet,
      createdAt: questionSet.createdAt || now
    };

    chat.messages.push({
      id: createId("questions"),
      role: "assistant",
      content: formatQuestionSetContent(normalizedQuestionSet),
      createdAt: now,
      status: "complete",
      questionSet: normalizedQuestionSet
    });
    chat.updatedAt = now;

    await this.save();
    return this.getPublicState();
  }

  async addProviderErrorMessage(chatId: string, error: ProviderError): Promise<AppState> {
    const chat = this.requireChat(chatId);
    const now = new Date().toISOString();
    const providerError = {
      ...error,
      createdAt: error.createdAt || now
    };

    chat.messages.push({
      id: createId("provider-error"),
      role: "assistant",
      content: `${providerError.title}\n\n${providerError.message}`,
      createdAt: now,
      status: "error",
      providerError
    });
    chat.updatedAt = now;

    await this.save();
    return this.getPublicState();
  }

  async addApprovalRequestMessage(chatId: string, approvalRequest: ApprovalRequest): Promise<AppState> {
    const chat = this.requireChat(chatId);
    const now = new Date().toISOString();
    const request = {
      ...approvalRequest,
      createdAt: approvalRequest.createdAt || now,
      status: approvalRequest.status || "pending"
    };

    chat.messages.push({
      id: createId("approval"),
      role: "assistant",
      content: formatApprovalRequestContent(request),
      createdAt: now,
      status: "complete",
      approvalRequest: request
    });
    chat.updatedAt = now;

    await this.save();
    return this.getPublicState();
  }

  async resolveApprovalMessage(
    chatId: string,
    messageId: string,
    approved: boolean
  ): Promise<{ request: ApprovalRequest | null; state: AppState }> {
    const chat = this.requireChat(chatId);
    const message = chat.messages.find((item) => item.id === messageId);

    if (!message?.approvalRequest || message.approvalRequest.status !== "pending") {
      return {
        request: null,
        state: await this.getPublicState()
      };
    }

    message.approvalRequest = {
      ...message.approvalRequest,
      status: approved ? "approved" : "denied"
    };
    message.content = formatApprovalRequestContent(message.approvalRequest);
    chat.updatedAt = new Date().toISOString();

    await this.save();

    return {
      request: message.approvalRequest,
      state: await this.getPublicState()
    };
  }

  async addToolActivity(
    chatId: string,
    activity: ToolActivity,
    status: ChatMessage["status"] = "thinking"
  ): Promise<{ messageId: string; state: AppState }> {
    const chat = this.requireChat(chatId);
    const now = new Date().toISOString();
    const messageId = createId("tool");

    chat.messages.push({
      id: messageId,
      role: "tool",
      content: formatToolActivityContent(activity),
      createdAt: now,
      status,
      toolActivity: activity
    });
    chat.updatedAt = now;

    await this.save();
    return {
      messageId,
      state: await this.getPublicState()
    };
  }

  async addImageGenerationMessage(
    chatId: string,
    activity: ImageGenerationActivity,
    status: ChatMessage["status"] = "thinking"
  ): Promise<{ messageId: string; state: AppState }> {
    const chat = this.requireChat(chatId);
    const now = new Date().toISOString();
    const messageId = createId("image");

    chat.messages.push({
      id: messageId,
      role: "assistant",
      content: formatImageGenerationContent(activity),
      createdAt: now,
      status,
      imageGeneration: activity
    });
    chat.updatedAt = now;

    await this.save();
    return {
      messageId,
      state: await this.getPublicState()
    };
  }

  async updateImageGenerationMessage(
    chatId: string,
    messageId: string,
    activity: ImageGenerationActivity,
    status: ChatMessage["status"] = "complete"
  ): Promise<AppState> {
    const chat = this.requireChat(chatId);
    const message = chat.messages.find((item) => item.id === messageId);

    if (!message) {
      throw new Error("That image generation could not be found.");
    }

    message.status = status;
    message.imageGeneration = activity;
    message.content = formatImageGenerationContent(activity);
    chat.updatedAt = new Date().toISOString();

    await this.save();
    return this.getPublicState();
  }

  async updateMessageFeedback(
    chatId: string,
    messageId: string,
    feedback: MessageFeedback
  ): Promise<AppState> {
    const chat = this.requireChat(chatId);
    const message = chat.messages.find((item) => item.id === messageId);

    if (!message || message.role !== "assistant") {
      throw new Error("That assistant message could not be found.");
    }

    message.feedback = feedback;
    chat.updatedAt = new Date().toISOString();
    await this.save();
    return this.getPublicState();
  }

  async updateToolActivity(
    chatId: string,
    messageId: string,
    activity: ToolActivity,
    status: ChatMessage["status"] = "complete"
  ): Promise<AppState> {
    const chat = this.requireChat(chatId);
    const message = chat.messages.find((item) => item.id === messageId);

    if (!message) {
      throw new Error("That tool activity could not be found.");
    }

    message.status = status;
    message.toolActivity = activity;
    message.content = formatToolActivityContent(activity);
    chat.updatedAt = new Date().toISOString();

    await this.save();
    return this.getPublicState();
  }

  async updateProviders(nextProviders: unknown): Promise<AppState> {
    const providerInput = isRecord(nextProviders) ? (nextProviders as ProviderSettingsInput) : {};

    for (const provider of providerIds) {
      const config = readProviderInput(providerInput, provider);

      if (typeof config?.apiKey === "string" && config.apiKey.trim()) {
        await this.secrets.write(provider, config.apiKey);
      }
    }

    const activeProvider = isProviderId(providerInput.activeProvider) ? providerInput.activeProvider : "openai";

    this.state.providers = normalizeExclusiveImageModelSelection({
      activeProvider,
      openai: this.redactProvider(this.sanitizeProvider("openai", readProviderInput(providerInput, "openai"))),
      claude: this.redactProvider(this.sanitizeProvider("claude", readProviderInput(providerInput, "claude"))),
      nvidia: this.redactProvider(this.sanitizeProvider("nvidia", readProviderInput(providerInput, "nvidia")))
    });

    await this.save();
    return this.getPublicState();
  }

  async updateImageModelScan(provider: ProviderId, scan: ImageModelScanResult): Promise<AppState> {
    const current = this.state.providers[provider];
    const selectedModel = scan.selectedModel || current.imageModel || scan.models[0]?.id || "";

    this.state.providers[provider] = {
      ...current,
      imageModel: provider === this.state.providers.activeProvider ? selectedModel : "",
      imageModels: scan.models.slice(0, maxImageModels),
      imageModelScan: {
        ...scan,
        selectedModel: provider === this.state.providers.activeProvider ? selectedModel : undefined,
        models: scan.models.slice(0, maxImageModels)
      }
    };
    this.state.providers = normalizeExclusiveImageModelSelection(this.state.providers);

    await this.save();
    return this.getPublicState();
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<AppState> {
    this.state.profile = sanitizeUserProfile({
      ...this.state.profile,
      ...profile,
      onboardingCompleted: profile.onboardingCompleted ?? true,
      updatedAt: new Date().toISOString()
    });
    await this.save();
    return this.getPublicState();
  }

  async updatePersonalization(personalization: unknown): Promise<AppState> {
    this.state.personalization = sanitizePersonalizationSettings(personalization);
    await this.save();
    return this.getPublicState();
  }

  async updateAiFunctionality(settings: unknown): Promise<AppState> {
    this.state.aiFunctionality = sanitizeAiFunctionalitySettings(settings);
    await this.save();
    return this.getPublicState();
  }

  async updateSecurity(security: unknown): Promise<AppState> {
    this.state.security = sanitizeSecuritySettings(security);
    await this.save();
    return this.getPublicState();
  }

  async resetLocalData(): Promise<AppState> {
    this.state = createDefaultState() as StoredState;
    await this.secrets.clear();
    await this.save();
    return this.getPublicState();
  }

  async setMaintenance(command: MaintenanceState | null): Promise<AppState> {
    this.state.maintenance = command;
    return this.getPublicState();
  }

  async updateWorkspace(root: string): Promise<AppState> {
    const workspaceRoot = await realpath(root);
    const metadata = await stat(workspaceRoot);

    if (!metadata.isDirectory()) {
      throw new Error("Choose a folder to use as the workspace.");
    }

    const recentRoots = [workspaceRoot, ...this.state.workspace.recentRoots.filter((recent) => recent !== workspaceRoot)].slice(0, 5);
    this.state.workspace = {
      root: workspaceRoot,
      recentRoots
    };
    await this.save();
    return this.getPublicState();
  }

  getWorkspaceRoot(): string | null {
    return this.state.workspace.root;
  }

  getDataPath(): string {
    return this.dataPath;
  }

  getSecurity(): SecuritySettings {
    return clone(this.state.security);
  }

  private requireChat(chatId: string): ChatThread {
    const chat = this.getChat(chatId);

    if (!chat) {
      throw new Error("That chat could not be found.");
    }

    return chat;
  }

  private createChatTitle(content: string): string {
    return createChatTitleFromContent(content);
  }

  private normalizeMessageContent(content: string): string {
    const trimmed = content.replace(/\0/g, "").trim();

    if (!trimmed) {
      throw new Error("Enter a message before sending.");
    }

    return trimmed.length > maxMessageLength ? trimmed.slice(0, maxMessageLength) : trimmed;
  }

  private sanitizeProvider(provider: ProviderId, config: ProviderConfigInput): ProviderConfig {
    const defaults = defaultProviderSettings[provider];
    const imageModels = sanitizeImageModels(config?.imageModels, defaults.imageModels ?? [], provider);
    const imageModel = sanitizeText(config?.imageModel, defaults.imageModel ?? imageModels[0]?.id ?? "", 160);

    return {
      enabled: typeof config?.enabled === "boolean" ? config.enabled : defaults.enabled,
      model: sanitizeText(config?.model, defaults.model, 160),
      fallbackModels: sanitizeFallbackModels(config?.fallbackModels, defaults.fallbackModels ?? []),
      reasoningEffort: readReasoningEffort(config?.reasoningEffort, defaults.reasoningEffort ?? "none"),
      baseUrl: sanitizeProviderBaseUrl(config?.baseUrl, defaults.baseUrl),
      imageModel,
      imageModels,
      imageModelScan: sanitizeImageModelScan(config?.imageModelScan, defaults.imageModelScan, provider, imageModel, imageModels),
      apiKey: typeof config?.apiKey === "string" ? config.apiKey : undefined,
      hasApiKey: typeof config?.hasApiKey === "boolean" ? config.hasApiKey : undefined
    };
  }

  private redactProvider(provider: ProviderConfig): ProviderConfig {
    const { apiKey: _apiKey, hasApiKey: _hasApiKey, ...rest } = provider;
    return rest;
  }

  private async save(): Promise<void> {
    await mkdir(this.dataPath, { recursive: true });
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}

function readProviderInput(input: ProviderSettingsInput, provider: ProviderId): ProviderConfigInput {
  const value = input[provider];
  return isRecord(value) ? (value as Partial<ProviderConfig>) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSecuritySettings(input: unknown): SecuritySettings {
  const record = isRecord(input) ? input : {};

  return {
    accessMode: readAccessMode(record.accessMode, defaultSecuritySettings.accessMode),
    allowFileRead: readBoolean(record.allowFileRead, defaultSecuritySettings.allowFileRead),
    allowFileEdit: readBoolean(record.allowFileEdit, defaultSecuritySettings.allowFileEdit),
    allowShellExecute: readBoolean(record.allowShellExecute, defaultSecuritySettings.allowShellExecute),
    allowInternetAccess: readBoolean(record.allowInternetAccess, defaultSecuritySettings.allowInternetAccess),
    requirePermissionPrompts: readBoolean(record.requirePermissionPrompts, defaultSecuritySettings.requirePermissionPrompts),
    autoContinueOnProviderError: readBoolean(
      record.autoContinueOnProviderError,
      defaultSecuritySettings.autoContinueOnProviderError
    ),
    showMessageIdentity: readBoolean(record.showMessageIdentity, defaultSecuritySettings.showMessageIdentity)
  };
}

function sanitizePersonalizationSettings(input: unknown): PersonalizationSettings {
  const record = isRecord(input) ? input : {};

  return {
    theme: readThemeMode(record.theme, defaultPersonalizationSettings.theme),
    accentTone: readAccentTone(record.accentTone, defaultPersonalizationSettings.accentTone),
    customAccentColor: readHexColor(record.customAccentColor, defaultPersonalizationSettings.customAccentColor),
    completionAnimation: readBoolean(record.completionAnimation, defaultPersonalizationSettings.completionAnimation),
    completionNotifications: readBoolean(record.completionNotifications, defaultPersonalizationSettings.completionNotifications),
    nvidiaPreset: readNvidiaPreset(record.nvidiaPreset, defaultPersonalizationSettings.nvidiaPreset),
    autonomousImageGeneration: readBoolean(
      record.autonomousImageGeneration,
      defaultPersonalizationSettings.autonomousImageGeneration
    ),
    autoAcceptImageGeneration: readBoolean(
      record.autoAcceptImageGeneration,
      defaultPersonalizationSettings.autoAcceptImageGeneration
    ),
    autoUpscaleGeneratedImages: readBoolean(
      record.autoUpscaleGeneratedImages,
      defaultPersonalizationSettings.autoUpscaleGeneratedImages
    ),
    autoCollapseImageCards: readBoolean(
      record.autoCollapseImageCards,
      defaultPersonalizationSettings.autoCollapseImageCards
    ),
    clearLocalDataOnVersionUpdate: readBoolean(
      record.clearLocalDataOnVersionUpdate,
      defaultPersonalizationSettings.clearLocalDataOnVersionUpdate
    )
  };
}

function sanitizeAiFunctionalitySettings(input: unknown): AiFunctionalitySettings {
  const record = isRecord(input) ? input : {};

  return {
    maxLetMeKnows: readMaxLetMeKnows(record.maxLetMeKnows, defaultAiFunctionalitySettings.maxLetMeKnows)
  };
}

function normalizeExclusiveImageModelSelection(providers: ProviderSettings): ProviderSettings {
  const activeProvider = isProviderId(providers.activeProvider) ? providers.activeProvider : "openai";
  const next = clone({
    ...providers,
    activeProvider
  });

  for (const provider of providerIds) {
    const config = next[provider];
    const selectedModel = provider === "nvidia" ? config.imageModel || config.imageModels?.[0]?.id || "" : "";

    next[provider] = {
      ...config,
      imageModel: selectedModel,
      imageModelScan: config.imageModelScan
        ? {
            ...config.imageModelScan,
            selectedModel: selectedModel || undefined
          }
        : config.imageModelScan
    };
  }

  return next;
}

function removeLegacyWelcomeChat(state: StoredState): StoredState {
  const chats = state.chats.filter((chat) => !(chat.id === "welcome" && chat.title === "Welcome to Coder Desktop"));

  return {
    ...state,
    chats,
    activeChatId: state.activeChatId === "welcome" ? chats[0]?.id ?? null : state.activeChatId
  };
}

function sanitizeUserProfile(input: unknown): UserProfile {
  const record = isRecord(input) ? input : {};
  const now = new Date().toISOString();

  return {
    onboardingCompleted: readBoolean(record.onboardingCompleted, false),
    preferredName: sanitizeText(record.preferredName, "", 80),
    workFocus: sanitizeText(record.workFocus, "", 240),
    interests: sanitizeText(record.interests, "", 240),
    styleNotes: sanitizeText(record.styleNotes, "", 320),
    updatedAt: sanitizeText(record.updatedAt, now, 80) || now
  };
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readAccessMode(value: unknown, fallback: SecuritySettings["accessMode"]): SecuritySettings["accessMode"] {
  return value === "ask-approval" || value === "approve" || value === "full" ? value : fallback;
}

function readAccentTone(value: unknown, fallback: AccentTone): AccentTone {
  return value === "graphite" || value === "blue" || value === "green" || value === "rose" || value === "custom" ? value : fallback;
}

function readNvidiaPreset(value: unknown, fallback: NidiaPresetId): NidiaPresetId {
  return value === "manual" || value === "development" || value === "everyday" ? value : fallback;
}

function readThemeMode(value: unknown, fallback: PersonalizationSettings["theme"]): PersonalizationSettings["theme"] {
  return value === "light" || value === "dark" ? value : fallback;
}

function readHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

function readReasoningEffort(value: unknown, fallback: ReasoningEffort): ReasoningEffort {
  return value === "none" || value === "low" || value === "medium" || value === "high" ? value : fallback;
}

function readMaxLetMeKnows(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(5, Math.max(0, Math.round(numeric)));
}

function sanitizeFallbackModels(value: unknown, fallback: string[]): string[] {
  const source = Array.isArray(value) ? value : fallback;
  const seen = new Set<string>();
  const models: string[] = [];

  for (const item of source) {
    const model = sanitizeText(item, "", 160);

    if (!model || seen.has(model)) {
      continue;
    }

    seen.add(model);
    models.push(model);

    if (models.length >= maxFallbackModels) {
      break;
    }
  }

  return models;
}

function formatTodoProgressContent(progress: TodoProgress): string {
  const completed = progress.items.filter((item) => item.status === "done").length;
  const lines = progress.items.map((item) => {
    const marker = item.status === "done" ? "Done" : item.status === "active" ? "Working" : "Pending";
    return `- ${marker}: ${item.title}`;
  });

  return [`Progress: ${progress.title} (${completed}/${progress.items.length})`, ...lines].join("\n");
}

function formatQuestionSetContent(questionSet: QuestionSet): string {
  const lines = questionSet.questions.map((question, index) => {
    const options = question.options
      .map((option) => `${option.label}${option.recommended ? " (Recommended)" : ""}`)
      .join(", ");
    return `${index + 1}. ${question.question}${options ? ` Options: ${options}` : ""}`;
  });

  return [`Let me know: ${questionSet.title}`, ...lines].join("\n");
}

function formatApprovalRequestContent(request: ApprovalRequest): string {
  const status =
    request.status === "approved" ? "Approved" : request.status === "denied" ? "Denied" : "Waiting for approval";

  return [`${request.title}: ${status}`, request.description].join("\n");
}

function formatImageGenerationContent(activity: ImageGenerationActivity): string {
  const imageCount = activity.images?.length ?? (activity.image ? 1 : 0);
  const status = activity.error ? "Failed" : imageCount > 0 ? "Generated" : "Generating";
  return [`${status}: ${activity.title}`, activity.description, `Model: ${activity.model}`].join("\n");
}

function sanitizeImageModels(value: unknown, fallback: ImageModelOption[], provider: ProviderId): ImageModelOption[] {
  const source = Array.isArray(value) ? value : fallback;
  const seen = new Set<string>();
  const models: ImageModelOption[] = [];

  for (const item of source) {
    if (!isRecord(item)) {
      continue;
    }

    const id = sanitizeText(item.id, "", 160);

    if (!id || seen.has(id) || !isAllowedImageModel(provider, id)) {
      continue;
    }

    seen.add(id);
    models.push({
      id,
      label: sanitizeText(item.label, id, 120),
      provider,
      source: readImageModelSource(item.source),
      quality: readImageModelQuality(item.quality)
    });

    if (models.length >= maxImageModels) {
      break;
    }
  }

  return models;
}

function isAllowedImageModel(provider: ProviderId, id: string): boolean {
  if (provider !== "nvidia") {
    return false;
  }

  return /\bflux\b|flux[._-]?\d|black-forest-labs\/flux/i.test(id);
}

function sanitizeImageModelScan(
  value: unknown,
  fallback: ImageModelScanResult | undefined,
  provider: ProviderId,
  selectedModel: string,
  models: ImageModelOption[]
): ImageModelScanResult {
  const record = isRecord(value) ? value : {};
  const fallbackScan = fallback ?? {
    provider,
    status: "needs-key" as const,
    message: "Scan image models to check this provider.",
    models: [],
    checkedAt: new Date().toISOString()
  };

  return {
    provider,
    status: readImageModelScanStatus(record.status, fallbackScan.status),
    message: sanitizeText(record.message, fallbackScan.message, 240),
    models,
    selectedModel: sanitizeText(record.selectedModel, selectedModel || fallbackScan.selectedModel || "", 160) || undefined,
    checkedAt: sanitizeText(record.checkedAt, fallbackScan.checkedAt, 80)
  };
}

function readImageModelSource(value: unknown): ImageModelOption["source"] {
  return value === "api" || value === "known" || value === "manual" ? value : "manual";
}

function readImageModelQuality(value: unknown): ImageModelOption["quality"] {
  return value === "fast" || value === "balanced" || value === "quality" ? value : "balanced";
}

function readImageModelScanStatus(value: unknown, fallback: ImageModelScanResult["status"]): ImageModelScanResult["status"] {
  return value === "ready" || value === "none" || value === "needs-key" || value === "error" ? value : fallback;
}

export function createChatTitleFromContent(content: string): string {
  const cleaned = content
    .replace(/[`*_~()[\]{}<>]/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "New chat";
  }

  const lowerCleaned = cleaned.toLowerCase();

  if (/^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)\b[!.'"\s-]*$/i.test(cleaned)) {
    return "User greeting";
  }

  if (/\bdonald\s+trump\b/.test(lowerCleaned) && /\b(web|website|site|page|html)\b/.test(lowerCleaned)) {
    return "Donald Trump website";
  }

  if (/\bparker\s*(get\s*a\s*job|getajob)\b/.test(lowerCleaned) && /\byoutube\b/.test(lowerCleaned)) {
    return /\bstream|livestream|live\b/.test(lowerCleaned) ? "Parker YouTube streams" : "Parker YouTube links";
  }

  if (/\bdiscord\b/.test(lowerCleaned) && /\bbot\b/.test(lowerCleaned)) {
    return /\b(test|testing|tested)\b/.test(lowerCleaned) ? "Discord bot and testing" : "Discord bot";
  }

  if (/\bgta\s*5\b|\bgrand theft auto\b/.test(lowerCleaned)) {
    return /\b(spec|smooth|play|run|gpu|graphics)\b/.test(lowerCleaned) ? "GTA 5 hardware check" : "GTA 5";
  }

  if (/\bcodex\b/.test(lowerCleaned) && /\b(installed|duration|how long|when|time)\b/.test(lowerCleaned)) {
    return "Finding Codex duration";
  }

  if (/\bgithub\b/.test(lowerCleaned) && /\b(read|summarize|repo|repository)\b/.test(lowerCleaned)) {
    return "Reading GitHub repository";
  }

  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "be",
    "build",
    "but",
    "can",
    "could",
    "create",
    "do",
    "does",
    "for",
    "from",
    "i",
    "in",
    "is",
    "it",
    "its",
    "make",
    "me",
    "of",
    "on",
    "or",
    "please",
    "then",
    "the",
    "this",
    "to",
    "use",
    "whatever",
    "want",
    "wants",
    "with",
    "you"
  ]);
  const originalWords = cleaned.split(" ").filter(Boolean);
  const meaningfulWords = originalWords.filter((word) => !stopWords.has(word.toLowerCase()));
  const titleWords = (meaningfulWords.length >= 3 ? meaningfulWords : originalWords).slice(0, 5);

  return titleWords.map(formatTitleWord).join(" ") || "New chat";
}

function formatTitleWord(word: string): string {
  if (/^[A-Z0-9]{2,6}$/.test(word)) {
    return word;
  }

  const lower = word.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}
