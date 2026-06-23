import type { ChatMessage, EditImageContext, FeedbackRating } from "../../shared/types";
import { UserRound } from "lucide-react";
import { ApprovalRequestCard } from "./ApprovalRequestCard";
import { CoderMark } from "./CoderMark";
import { ImageGenerationCard } from "./ImageGenerationCard";
import { MarkdownText } from "./MarkdownText";
import { MessageFeedbackActions } from "./MessageFeedbackActions";
import { ProviderErrorCard } from "./ProviderErrorCard";
import { QuestionSetCard } from "./QuestionSetCard";
import { TodoProgressCard } from "./TodoProgressCard";
import { ToolActivityCard } from "./ToolActivityCard";

interface MessageBubbleProps {
  isHighlighted?: boolean;
  message: ChatMessage;
  onContinueProviderError: () => void;
  onEditImage?: (context: EditImageContext) => void;
  onResolveApproval: (messageId: string, approved: boolean) => void;
  onSend: (content: string) => void;
  onSubmitFeedback: (messageId: string, rating: FeedbackRating, note?: string) => void;
  showIdentity: boolean;
  showProviderErrorContinue: boolean;
}

export function MessageBubble({
  isHighlighted = false,
  message,
  onContinueProviderError,
  onEditImage,
  onResolveApproval,
  onSend,
  onSubmitFeedback,
  showIdentity,
  showProviderErrorContinue
}: MessageBubbleProps) {
  const label = message.role === "user" ? "You" : message.role === "assistant" ? "Coder" : "Tool";
  const toolActivity = message.role === "tool" ? message.toolActivity : undefined;
  const hasStructuredCard = Boolean(message.approvalRequest || message.imageGeneration || message.todoProgress || message.questionSet || message.providerError);
  const canShowFeedback = message.role === "assistant" && !hasStructuredCard && message.status === "complete" && message.content.trim().length > 0;

  return (
    <article
      className={`message ${message.role}${toolActivity || hasStructuredCard ? " tool-activity-message" : ""}${
        showIdentity ? "" : " no-identity"
      }${isHighlighted ? " just-completed" : ""}`}
    >
      {showIdentity && !toolActivity && !hasStructuredCard ? (
        <div className="message-avatar" aria-hidden="true">
          {message.role === "assistant" ? <CoderMark size={18} /> : <UserRound size={17} />}
        </div>
      ) : null}
      <div className="message-body">
        {toolActivity ? (
          <ToolActivityCard activity={toolActivity} status={message.status} />
        ) : message.imageGeneration ? (
          <ImageGenerationCard activity={message.imageGeneration} status={message.status} onEditImage={onEditImage} />
        ) : message.approvalRequest ? (
          <ApprovalRequestCard request={message.approvalRequest} onResolve={(approved) => onResolveApproval(message.id, approved)} />
        ) : message.providerError ? (
          <ProviderErrorCard error={message.providerError} onContinue={onContinueProviderError} showContinue={showProviderErrorContinue} />
        ) : message.todoProgress ? (
          <TodoProgressCard progress={message.todoProgress} />
        ) : message.questionSet ? (
          <QuestionSetCard questionSet={message.questionSet} onSend={onSend} />
        ) : (
          <>
            {showIdentity ? <div className="message-role">{label}</div> : null}
            <MarkdownText content={message.content} />
            {canShowFeedback ? <MessageFeedbackActions message={message} onSubmitFeedback={onSubmitFeedback} /> : null}
          </>
        )}
      </div>
    </article>
  );
}
