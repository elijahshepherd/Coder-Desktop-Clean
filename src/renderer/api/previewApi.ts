import { createDefaultState, knownNvidiaImageModels } from "../../shared/defaults";
import { providerIds } from "../../shared/providers";
import type { AppState, DesktopApi, ImageModelScanResult, ProviderConfig, ProviderId, ProviderSettings } from "../../shared/types";

const browserStateKey = "coder-desktop-browser-state";
const browserOnlyMessage =
  "Open Coder Desktop as the desktop app to use providers, updates, files, folders, and shell commands.";

export function createPreviewApi(): DesktopApi {
  let state = loadBrowserState();

  const update = (next: AppState): Promise<AppState> => {
    state = next;
    saveBrowserState(state);
    return Promise.resolve(state);
  };

  return {
    getState: () => Promise.resolve(state),
    createChat: () => {
      const now = new Date().toISOString();
      const chat = {
        id: `preview-${Date.now()}`,
        title: "New chat",
        provider: state.providers.activeProvider,
        messages: [],
        createdAt: now,
        updatedAt: now
      };

      return update({
        ...state,
        hasSeenStarterCard: true,
        activeChatId: chat.id,
        chats: [chat, ...state.chats]
      });
    },
    markStarterCardSeen: () =>
      update({
        ...state,
        hasSeenStarterCard: true
      }),
    deleteChat: (chatId) => {
      const index = state.chats.findIndex((chat) => chat.id === chatId);
      const chats = state.chats.filter((chat) => chat.id !== chatId);

      return update({
        ...state,
        chats,
        activeChatId: state.activeChatId === chatId ? chats[Math.max(0, index - 1)]?.id ?? chats[0]?.id ?? null : state.activeChatId
      });
    },
    setActiveChat: (chatId) =>
      update({
        ...state,
        activeChatId: chatId
      }),
    sendMessage: (chatId, content) => {
      const now = new Date().toISOString();
      return update({
        ...state,
        chats: state.chats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title: chat.title === "New chat" ? content.slice(0, 48) : chat.title,
                updatedAt: now,
                messages: [
                  ...chat.messages,
                  {
                    id: `preview-user-${Date.now()}`,
                    role: "user",
                    content,
                    createdAt: now,
                    status: "complete"
                  },
                  {
                    id: `preview-assistant-${Date.now()}`,
                    role: "assistant",
                    content: `**Browser view is read-only.** ${browserOnlyMessage}`,
                    createdAt: now,
                    status: "complete",
                    durationMs: 1200
                  }
                ]
              }
            : chat
        )
      });
    },
    cancelChat: (chatId) => {
      const now = new Date().toISOString();
      return update({
        ...state,
        chats: state.chats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                updatedAt: now,
                messages: [
                  ...chat.messages,
                  {
                    id: `preview-stop-${Date.now()}`,
                    role: "assistant",
                    content: "Stopped the current request.",
                    createdAt: now,
                    status: "complete"
                  }
                ]
              }
            : chat
        )
      });
    },
    resolveApproval: () => rejectBrowserOnly(),
    submitMessageFeedback: (request) => {
      const now = new Date().toISOString();
      return update({
        ...state,
        chats: state.chats.map((chat) =>
          chat.id === request.chatId
            ? {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === request.messageId
                    ? {
                        ...message,
                        feedback: {
                          rating: request.rating,
                          note: request.note,
                          submittedAt: now,
                          status: "failed"
                        }
                      }
                    : message
                )
              }
            : chat
        )
      });
    },
    updateProviders: (providers) =>
      update({
        ...state,
        providers: createPublicPreviewProviders(providers, state.providers)
      }),
    validateProviders: () =>
      Promise.resolve(
        providerIds.map((provider) => ({
          provider,
          providerLabel: provider,
          status: state.providers[provider].baseUrl ? ("ok" as const) : ("warning" as const),
          message: state.providers[provider].baseUrl
            ? "Browser preview cannot scan live providers. The desktop app will scan this setting."
            : "Add a base URL before provider scanning.",
          checkedAt: new Date().toISOString()
        }))
      ),
    scanImageModels: (provider) => {
      const scan = createPreviewImageScan(provider);
      return update({
        ...state,
        providers: {
          ...state.providers,
          [provider]: {
            ...state.providers[provider],
            imageModel: scan.selectedModel ?? "",
            imageModels: scan.models,
            imageModelScan: scan
          }
        }
      });
    },
    runProviderTest: () =>
      Promise.resolve({
        checkedAt: new Date().toISOString(),
        failures: [],
        message: "The desktop app runs provider health checks automatically.",
        providers: state.providers,
        removals: [],
        status: "warning" as const
      }),
    updateProfile: (profile) =>
      update({
        ...state,
        profile: {
          ...state.profile,
          ...profile,
          onboardingCompleted: profile.onboardingCompleted ?? true,
          updatedAt: new Date().toISOString()
        }
      }),
    updatePersonalization: (personalization) => update({ ...state, personalization }),
    updateAiFunctionality: (aiFunctionality) => update({ ...state, aiFunctionality }),
    updateSecurity: (security) => update({ ...state, security }),
    notifyChatComplete: () => Promise.resolve(),
    createGeneratedImageLink: (dataUrl) => Promise.resolve(dataUrl),
    saveGeneratedImage: () =>
      Promise.resolve({ ok: false, revealed: false, message: "The browser preview cannot save generated images to disk." }),
    reportBug: () => Promise.resolve({ status: "skipped", message: "The browser preview does not send bug reports." }),
    resetLocalData: () => update(createDefaultState()),
    reinstallCurrentVersion: () => Promise.resolve("The browser preview cannot reinstall the desktop app."),
    selectWorkspace: () =>
      update({
        ...state,
        workspace: {
          root: null,
          recentRoots: []
        }
      }),
    listFiles: () => rejectBrowserOnly(),
    readFile: () => rejectBrowserOnly(),
    previewDiff: () => rejectBrowserOnly(),
    writeFile: () => rejectBrowserOnly(),
    createFolder: () => rejectBrowserOnly(),
    deleteFile: () => rejectBrowserOnly(),
    deleteFolder: () => rejectBrowserOnly(),
    runCommand: () => rejectBrowserOnly(),
    checkForUpdate: () => Promise.resolve(null),
    installUpdate: () => rejectBrowserOnly(),
    onUpdateAvailable: (_listener) => () => undefined,
    onStateChanged: (_listener) => () => undefined,
    onUpdateProgress: (_listener) => () => undefined,
    onProviderTestProgress: (_listener) => () => undefined
  };
}

function createPreviewImageScan(provider: ProviderId): ImageModelScanResult {
  const checkedAt = new Date().toISOString();

  if (provider === "nvidia") {
    return {
      provider,
      status: "ready",
      message: "Browser preview added known NVIDIA FLUX image models.",
      models: knownNvidiaImageModels,
      selectedModel: knownNvidiaImageModels[0]?.id,
      checkedAt
    };
  }

  return {
    provider,
    status: "none",
    message: "Image generation is available through NVIDIA FLUX models.",
    models: [],
    checkedAt
  };
}

function loadBrowserState(): AppState {
  try {
    const stored = window.localStorage.getItem(browserStateKey);
    return stored ? normalizePreviewProviderState(JSON.parse(stored) as AppState) : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

function saveBrowserState(state: AppState): void {
  try {
    window.localStorage.setItem(browserStateKey, JSON.stringify(state));
  } catch {
    // Browser persistence is best effort. The desktop app uses the main-process store.
  }
}

function createPublicPreviewProviders(nextProviders: ProviderSettings, currentProviders: ProviderSettings): ProviderSettings {
  return {
    activeProvider: nextProviders.activeProvider,
    openai: createPublicPreviewProviderConfig(nextProviders.openai, currentProviders.openai),
    claude: createPublicPreviewProviderConfig(nextProviders.claude, currentProviders.claude),
    nvidia: createPublicPreviewProviderConfig(nextProviders.nvidia, currentProviders.nvidia)
  };
}

function createPublicPreviewProviderConfig(nextConfig: ProviderConfig, currentConfig: ProviderConfig): ProviderConfig {
  const hasNewKey = Boolean(nextConfig.apiKey?.trim());

  return {
    ...nextConfig,
    apiKey: "",
    hasApiKey: hasNewKey || Boolean(currentConfig.hasApiKey)
  };
}

function normalizePreviewProviderState(state: AppState): AppState {
  const providers = { ...state.providers };
  const defaults = createDefaultState();
  const chats = state.chats.filter((chat) => !(chat.id === "welcome" && chat.title === "Welcome to Coder Desktop"));

  for (const provider of providerIds) {
    const config = providers[provider];
    const imageModels =
      provider === "nvidia" ? (config.imageModels ?? []).filter((model) => /flux/i.test(model.id)) : [];
    const safeImageModels = provider === "nvidia" && imageModels.length > 0 ? imageModels : provider === "nvidia" ? knownNvidiaImageModels : [];

    providers[provider] = {
      ...config,
      imageModel: provider === "nvidia" ? config.imageModel || safeImageModels[0]?.id || "" : "",
      imageModels: safeImageModels,
      apiKey: "",
      hasApiKey: Boolean(config.hasApiKey || config.apiKey?.trim())
    };
  }

  return {
    ...state,
    hasSeenStarterCard: typeof state.hasSeenStarterCard === "boolean" ? state.hasSeenStarterCard : true,
    chats,
    activeChatId: state.activeChatId === "welcome" ? chats[0]?.id ?? null : state.activeChatId,
    providers,
    personalization: { ...defaults.personalization, ...(state.personalization ?? {}) },
    aiFunctionality: state.aiFunctionality ?? defaults.aiFunctionality,
    profile: state.profile ?? { ...defaults.profile, onboardingCompleted: true }
  };
}

function rejectBrowserOnly<T>(): Promise<T> {
  return Promise.reject(new Error(`This browser view is read-only. ${browserOnlyMessage}`));
}
