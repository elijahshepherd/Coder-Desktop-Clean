import { KeyRound, MessageSquarePlus, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatThread, EditImageContext, FeedbackRating, PersonalizationSettings, ProviderSettings, SecuritySettings } from "../../shared/types";
import { desktopApi } from "../api/desktopApi";
import type { QueuedPrompt } from "../hooks/useCoderDesktopState";
import { AccessModeMenu } from "./AccessModeMenu";
import { CoderMark } from "./CoderMark";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { ProviderMark } from "./ProviderMark";
import { ShimmerText } from "./ShimmerText";
import { TodoProgressCard } from "./TodoProgressCard";

interface ChatWorkspaceProps {
  chat: ChatThread | null;
  isSending: boolean;
  notice: string | null;
  personalization: PersonalizationSettings;
  providers: ProviderSettings;
  queuedPrompts: QueuedPrompt[];
  security: SecuritySettings;
  showStarterCard: boolean;
  onCancel: () => void;
  onCreateChat: () => void;
  onOpenSettings: () => void;
  onRemoveQueuedPrompt: (promptId: string) => void;
  onResolveApproval: (messageId: string, approved: boolean) => void;
  onSend: (content: string) => void;
  onSecurityChange: (security: SecuritySettings) => void;
  onStarterCardSeen: () => void;
  onSubmitFeedback: (messageId: string, rating: FeedbackRating, note?: string) => void;
}

export function ChatWorkspace({
  chat,
  isSending,
  notice,
  personalization,
  providers,
  queuedPrompts,
  security,
  showStarterCard,
  onCancel,
  onCreateChat,
  onOpenSettings,
  onRemoveQueuedPrompt,
  onResolveApproval,
  onSend,
  onSecurityChange,
  onStarterCardSeen,
  onSubmitFeedback
}: ChatWorkspaceProps) {
  const [completedMessageId, setCompletedMessageId] = useState<string | null>(null);
  const wasSendingRef = useRef(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const activeProvider = providers[providers.activeProvider];
  const hasMessages = Boolean(chat?.messages.length);
  const latestTodo = useMemo(() => [...(chat?.messages ?? [])].reverse().find((message) => message.todoProgress)?.todoProgress, [chat?.messages]);
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date());
  const openStarterSettings = () => {
    onStarterCardSeen();
    onOpenSettings();
  };
  const createStarterChat = () => {
    onStarterCardSeen();
    onCreateChat();
  };
  const handleEditImage = useCallback((context: EditImageContext) => {
    const prompt = context.revisedPrompt || context.sourcePrompt;
    onSend(`Edit this image: ${prompt}`);
  }, [onSend]);
  const sendComposerMessage = (content: string) => {
    if (showStarterCard) {
      onStarterCardSeen();
    }

    onSend(content);
  };

  const lastNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    const wasSending = wasSendingRef.current;
    wasSendingRef.current = isSending;

    if (!wasSending || isSending || !chat) {
      return undefined;
    }

    const latestCompletedMessage = [...chat.messages]
      .reverse()
      .find((message) => (message.role === "assistant" || message.role === "tool") && message.status !== "thinking");

    if (!latestCompletedMessage || latestCompletedMessage.content.trim() === "Stopped the current request.") {
      return undefined;
    }

    if (personalization.completionAnimation) {
      setCompletedMessageId(latestCompletedMessage.id);
      const timer = window.setTimeout(() => setCompletedMessageId(null), 2600);
      if (personalization.completionNotifications && lastNotifiedRef.current !== latestCompletedMessage.id) {
        lastNotifiedRef.current = latestCompletedMessage.id;
        void desktopApi.notifyChatComplete("Coder Desktop finished", chat.title);
      }
      return () => window.clearTimeout(timer);
    }

    if (personalization.completionNotifications && lastNotifiedRef.current !== latestCompletedMessage.id) {
      lastNotifiedRef.current = latestCompletedMessage.id;
      void desktopApi.notifyChatComplete("Coder Desktop finished", chat.title);
    }

    return undefined;
  }, [chat, isSending, personalization.completionAnimation, personalization.completionNotifications]);

  useEffect(() => {
    const messagesElement = messagesRef.current;

    if (!messagesElement || !chat?.messages.length) {
      return;
    }

    messagesElement.scrollTop = messagesElement.scrollHeight;
  }, [chat?.id, chat?.messages.length, chat?.updatedAt, isSending]);

  return (
    <section className="workspace">
      <header className="workspace-topbar">
        <div className="thread-heading">
          <h2>{chat?.title ?? "Coder Desktop"}</h2>
        </div>
      </header>

      <div className="workspace-canvas">
        <div className="notice-slot">{notice ? <div className="notice">{notice}</div> : null}</div>
        {latestTodo ? (
          <div className="floating-todo-card" aria-live="polite">
            <TodoProgressCard progress={latestTodo} />
          </div>
        ) : null}

        {showStarterCard ? (
          <div className="welcome-stage">
            <section className="getting-started-card" aria-label="Getting started">
              <CoderMark className="welcome-coder-mark" size={68} />
              <div>
                <h3>Start with Coder Desktop</h3>
                <p>
                  Connect a provider, choose how much local access Coder Desktop should have, then start a chat when you are ready
                  to build, research, test, or fix something.
                </p>
              </div>
              <div className="getting-started-grid">
                <button type="button" onClick={openStarterSettings}>
                  <KeyRound size={16} />
                  <span>Set up providers</span>
                </button>
                <button type="button" onClick={openStarterSettings}>
                  <ShieldCheck size={16} />
                  <span>Review access</span>
                </button>
                <button type="button" onClick={createStarterChat}>
                  <MessageSquarePlus size={16} />
                  <span>New chat</span>
                </button>
              </div>
            </section>
          </div>
        ) : hasMessages && chat ? (
          <div className="messages" ref={messagesRef}>
            <div className="conversation-pill">{chat.title}</div>
            {chat.messages.map((message) => (
              <MessageBubble
                isHighlighted={personalization.completionAnimation && message.id === completedMessageId}
                key={message.id}
                message={message}
                onContinueProviderError={() => onSend("continue")}
                onEditImage={handleEditImage}
                onResolveApproval={onResolveApproval}
                onSend={onSend}
                onSubmitFeedback={onSubmitFeedback}
                showIdentity={security.showMessageIdentity}
                showProviderErrorContinue={!security.autoContinueOnProviderError}
              />
            ))}
            {isSending ? <ShimmerText text="Working on your request" /> : null}
          </div>
        ) : (
          <div className="welcome-stage simple-welcome-stage" aria-label="Empty chat">
            <CoderMark className="welcome-coder-mark" size={78} />
            <h3>Let's build</h3>
          </div>
        )}

        {!hasMessages && isSending ? <ShimmerText text="Working on your request" /> : null}

        <div className="composer-dock">
          {queuedPrompts.length ? (
            <div className="queued-prompts" aria-label="Queued prompts">
              {queuedPrompts.map((prompt, index) => (
                <div className="queued-prompt" key={prompt.id}>
                  <span>Queued {index + 1}</span>
                  <p>{prompt.content}</p>
                  <button type="button" aria-label="Remove queued prompt" onClick={() => onRemoveQueuedPrompt(prompt.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <Composer disabled={false} isQueuing={isSending} onCancel={onCancel} onSend={sendComposerMessage} />
          <div className="composer-status">
            <span>
              <ProviderMark provider={providers.activeProvider} />
              {activeProvider.model || "No model selected"}
            </span>
            <AccessModeMenu security={security} onChange={onSecurityChange} />
            <span>{dateLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
