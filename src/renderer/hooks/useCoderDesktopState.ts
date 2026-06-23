import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { desktopApi } from "../api/desktopApi";
import type {
  AppState,
  FeedbackRating,
  ProviderConfig,
  ProviderDiagnostic,
  ProviderSettings,
  PersonalizationSettings,
  AiFunctionalitySettings,
  SecuritySettings,
  ThemeMode,
  UserProfile
} from "../../shared/types";

export interface QueuedPrompt {
  id: string;
  content: string;
  createdAt: string;
}

interface CoderDesktopActions {
  createChat: () => Promise<void>;
  markStarterCardSeen: () => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  cancelActiveChat: () => Promise<void>;
  resolveApproval: (messageId: string, approved: boolean) => Promise<void>;
  submitMessageFeedback: (messageId: string, rating: FeedbackRating, note?: string) => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  removeQueuedPrompt: (chatId: string, promptId: string) => void;
  selectWorkspace: () => Promise<void>;
  updateProviders: (providers: ProviderSettings) => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  updatePersonalization: (personalization: PersonalizationSettings) => Promise<void>;
  updateAiFunctionality: (settings: AiFunctionalitySettings) => Promise<void>;
  updateSecurity: (security: SecuritySettings) => Promise<void>;
  setSearch: (value: string) => void;
  setNotice: (notice: string | null) => void;
}

export function useCoderDesktopState(): {
  actions: CoderDesktopActions;
  activeChat: AppState["chats"][number] | null;
  filteredChats: AppState["chats"];
  isSending: boolean;
  notice: string | null;
  providerDiagnostics: ProviderDiagnostic[];
  queuedPrompts: QueuedPrompt[];
  search: string;
  sendingChatIds: ReadonlySet<string>;
  state: AppState | null;
  theme: ThemeMode;
} {
  const [state, setState] = useState<AppState | null>(null);
  const [search, setSearch] = useState("");
  const [queuedPromptsByChatId, setQueuedPromptsByChatId] = useState<Record<string, QueuedPrompt[]>>({});
  const [sendingChatIds, setSendingChatIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [providerDiagnostics, setProviderDiagnostics] = useState<ProviderDiagnostic[]>([]);
  const providerUpdateSerialRef = useRef(0);
  const queuedPromptsRef = useRef(queuedPromptsByChatId);
  const sendingChatIdsRef = useRef(sendingChatIds);
  const autoContinueRef = useRef<Record<string, { count: number; userMessageId: string }>>({});
  const canceledChatIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    queuedPromptsRef.current = queuedPromptsByChatId;
  }, [queuedPromptsByChatId]);

  useEffect(() => {
    sendingChatIdsRef.current = sendingChatIds;
  }, [sendingChatIds]);

  useEffect(() => {
    let isMounted = true;
    const removeStateListener = desktopApi.onStateChanged((nextState) => {
      if (isMounted) {
        setState(nextState);
      }
    });

    desktopApi
      .getState()
      .then((nextState) => {
        if (isMounted) {
          setState(nextState);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setNotice(formatError(error));
        }
      });

    return () => {
      isMounted = false;
      removeStateListener();
    };
  }, []);

  useEffect(() => {
    if (!state) {
      return undefined;
    }

    let isCurrent = true;
    const timer = window.setTimeout(() => {
      void desktopApi
        .validateProviders()
        .then((diagnostics) => {
          if (isCurrent) {
            setProviderDiagnostics(diagnostics);
          }
        })
        .catch(() => undefined);
    }, 1200);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [state?.providers.activeProvider, state?.providers.openai.model, state?.providers.openai.baseUrl, state?.providers.claude.model, state?.providers.claude.baseUrl, state?.providers.nvidia.model, state?.providers.nvidia.baseUrl]);

  const activeChat = useMemo(
    () => state?.chats.find((chat) => chat.id === state.activeChatId) ?? null,
    [state]
  );

  const filteredChats = useMemo(() => {
    if (!state) {
      return [];
    }

    const query = search.trim().toLowerCase();

    if (!query) {
      return state.chats;
    }

    return state.chats.filter((chat) => {
      const messageText = chat.messages.map((message) => message.content).join(" ").toLowerCase();
      return chat.title.toLowerCase().includes(query) || messageText.includes(query);
    });
  }, [search, state]);

  const runStateAction = useCallback(async (action: () => Promise<AppState>, clearNotice = true) => {
    if (clearNotice) {
      setNotice(null);
    }

    try {
      setState(await action());
    } catch (error) {
      setNotice(formatError(error));
    }
  }, []);

  const runQueuedSend = useCallback(
    async (chatId: string, content: string) => {
      if (canceledChatIdsRef.current.has(chatId) && content.trim().toLowerCase() === "continue") {
        return;
      }

      setSendingChatIds((current) => {
        const next = new Set(current).add(chatId);
        sendingChatIdsRef.current = next;
        return next;
      });

      let nextPrompt: QueuedPrompt | undefined;

      try {
        await runStateAction(() => desktopApi.sendMessage(chatId, content));
      } finally {
        const queue = queuedPromptsRef.current[chatId] ?? [];
        nextPrompt = queue[0];
        const nextQueues = {
          ...queuedPromptsRef.current,
          [chatId]: queue.slice(1)
        };
        queuedPromptsRef.current = nextQueues;
        setQueuedPromptsByChatId(nextQueues);
        setSendingChatIds((current) => {
          const next = new Set(current);
          next.delete(chatId);
          sendingChatIdsRef.current = next;
          return next;
        });

        if (nextPrompt) {
          void runQueuedSend(chatId, nextPrompt.content);
        }
      }
    },
    [runStateAction]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      let chatId = activeChat?.id;

      if (!chatId) {
        const nextState = await desktopApi.createChat();
        setState(nextState);
        chatId = nextState.activeChatId ?? undefined;
      }

      if (!chatId) {
        setNotice("Create a chat before sending a message.");
        return;
      }

      canceledChatIdsRef.current.delete(chatId);

      if (sendingChatIdsRef.current.has(chatId)) {
        const prompt: QueuedPrompt = {
          id: `queued-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          content,
          createdAt: new Date().toISOString()
        };
        setQueuedPromptsByChatId((current) => ({
          ...current,
          [chatId]: [...(current[chatId] ?? []), prompt]
        }));
        queuedPromptsRef.current = {
          ...queuedPromptsRef.current,
          [chatId]: [...(queuedPromptsRef.current[chatId] ?? []), prompt]
        };
        return;
      }

      await runQueuedSend(chatId, content);
    },
    [activeChat?.id, runQueuedSend]
  );

  const removeQueuedPrompt = useCallback(
    (chatId: string, promptId: string) => {
      const nextQueues = {
        ...queuedPromptsRef.current,
        [chatId]: (queuedPromptsRef.current[chatId] ?? []).filter((prompt) => prompt.id !== promptId)
      };
      queuedPromptsRef.current = nextQueues;
      setQueuedPromptsByChatId(nextQueues);
    },
    []
  );

  useEffect(() => {
    if (!state?.security.autoContinueOnProviderError) {
      return;
    }

    for (const chat of state.chats) {
      if (sendingChatIdsRef.current.has(chat.id)) {
        continue;
      }

      if (canceledChatIdsRef.current.has(chat.id)) {
        continue;
      }

      const latestMessage = chat.messages.at(-1);

      if (!latestMessage?.providerError) {
        continue;
      }

      if (isSetupProviderError(latestMessage)) {
        continue;
      }

      const userMessage = findLatestUserMessage(chat.messages);

      if (!userMessage) {
        continue;
      }

      const userMessageId = userMessage.id;
      const record = autoContinueRef.current[chat.id];

      if (
        userMessage.content.trim().toLowerCase() === "continue" ||
        (record?.userMessageId === userMessageId && record.count >= 1)
      ) {
        continue;
      }

      autoContinueRef.current[chat.id] = {
        userMessageId,
        count: record?.userMessageId === userMessageId ? record.count + 1 : 1
      };
      void runQueuedSend(chat.id, "continue");
    }
  }, [runQueuedSend, state]);

  const actions = useMemo<CoderDesktopActions>(
    () => ({
      createChat: () => runStateAction(desktopApi.createChat),
      markStarterCardSeen: () => runStateAction(desktopApi.markStarterCardSeen, false),
      deleteChat: (chatId) => runStateAction(() => desktopApi.deleteChat(chatId)),
      cancelActiveChat: async () => {
        const chatId = activeChat?.id;

        if (!chatId) {
          return;
        }

        const nextQueues = {
          ...queuedPromptsRef.current,
          [chatId]: []
        };
        queuedPromptsRef.current = nextQueues;
        setQueuedPromptsByChatId(nextQueues);
        canceledChatIdsRef.current.add(chatId);
        const latestUserMessage = activeChat ? findLatestUserMessage(activeChat.messages) : null;

        if (latestUserMessage) {
          autoContinueRef.current[chatId] = {
            userMessageId: latestUserMessage.id,
            count: Number.MAX_SAFE_INTEGER
          };
        }

        await runStateAction(() => desktopApi.cancelChat(chatId), false);
        setSendingChatIds((current) => {
          const next = new Set(current);
          next.delete(chatId);
          sendingChatIdsRef.current = next;
          return next;
        });
      },
      resolveApproval: async (messageId, approved) => {
        const chatId = activeChat?.id;

        if (!chatId) {
          return;
        }

        if (approved) {
          setSendingChatIds((current) => {
            const next = new Set(current).add(chatId);
            sendingChatIdsRef.current = next;
            return next;
          });
        }

        try {
          await runStateAction(() => desktopApi.resolveApproval(chatId, messageId, approved), false);
        } finally {
          if (approved) {
            setSendingChatIds((current) => {
              const next = new Set(current);
              next.delete(chatId);
              sendingChatIdsRef.current = next;
              return next;
            });
          }
        }
      },
      submitMessageFeedback: async (messageId, rating, note) => {
        const chatId = activeChat?.id;

        if (!chatId) {
          return;
        }

        await runStateAction(() => desktopApi.submitMessageFeedback({ chatId, messageId, rating, note }), false);
      },
      selectChat: (chatId) => runStateAction(() => desktopApi.setActiveChat(chatId)),
      sendMessage,
      removeQueuedPrompt,
      selectWorkspace: () => runStateAction(desktopApi.selectWorkspace),
      updatePersonalization: (personalization) => runStateAction(() => desktopApi.updatePersonalization(personalization)),
      updateAiFunctionality: (settings) => runStateAction(() => desktopApi.updateAiFunctionality(settings)),
      updateProviders: async (providers) => {
        const updateSerial = providerUpdateSerialRef.current + 1;
        providerUpdateSerialRef.current = updateSerial;
        setNotice(null);
        setState((current) =>
          current
            ? {
                ...current,
                providers: createPublicProviderSettings(providers, current.providers)
              }
            : current
        );

        try {
          const nextState = await desktopApi.updateProviders(providers);

          if (providerUpdateSerialRef.current === updateSerial) {
            setState(nextState);
            void desktopApi.validateProviders().then(setProviderDiagnostics).catch(() => undefined);
          }
        } catch (error) {
          if (providerUpdateSerialRef.current === updateSerial) {
            setNotice(formatError(error));
          }
        }
      },
      updateProfile: (profile) => runStateAction(() => desktopApi.updateProfile(profile)),
      updateSecurity: (security) => runStateAction(() => desktopApi.updateSecurity(security)),
      setSearch,
      setNotice
    }),
    [activeChat?.id, removeQueuedPrompt, runStateAction, sendMessage]
  );

  return {
    actions,
    activeChat,
    filteredChats,
    isSending: activeChat ? sendingChatIds.has(activeChat.id) : false,
    notice,
    providerDiagnostics,
    queuedPrompts: activeChat ? queuedPromptsByChatId[activeChat.id] ?? [] : [],
    search,
    sendingChatIds,
    state,
    theme: state?.personalization.theme ?? "light"
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createPublicProviderSettings(nextProviders: ProviderSettings, currentProviders: ProviderSettings): ProviderSettings {
  return {
    activeProvider: nextProviders.activeProvider,
    openai: createPublicProviderConfig(nextProviders.openai, currentProviders.openai),
    claude: createPublicProviderConfig(nextProviders.claude, currentProviders.claude),
    nvidia: createPublicProviderConfig(nextProviders.nvidia, currentProviders.nvidia)
  };
}

function createPublicProviderConfig(nextConfig: ProviderConfig, currentConfig: ProviderConfig): ProviderConfig {
  const hasNewKey = Boolean(nextConfig.apiKey?.trim());

  return {
    ...nextConfig,
    apiKey: "",
    hasApiKey: hasNewKey || Boolean(currentConfig.hasApiKey)
  };
}

function isSetupProviderError(message: AppState["chats"][number]["messages"][number]): boolean {
  const providerError = message.providerError;

  if (!providerError) {
    return false;
  }

  return /needs an api key|api key needed|missing api key|disabled in settings|selected provider is disabled/i.test(
    `${providerError.title} ${providerError.message}`
  );
}

function findLatestUserMessage(messages: AppState["chats"][number]["messages"]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return messages[index];
    }
  }

  return null;
}
