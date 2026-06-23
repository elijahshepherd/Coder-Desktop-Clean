import { Check, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChatMessage, FeedbackRating } from "../../shared/types";
import { CopyButton } from "./CopyButton";

interface MessageFeedbackActionsProps {
  message: ChatMessage;
  onSubmitFeedback: (messageId: string, rating: FeedbackRating, note?: string) => void;
}

export function MessageFeedbackActions({ message, onSubmitFeedback }: MessageFeedbackActionsProps) {
  const [ratingDraft, setRatingDraft] = useState<FeedbackRating | null>(null);
  const [note, setNote] = useState("");
  const durationLabel = useMemo(() => formatDuration(message.durationMs), [message.durationMs]);
  const feedbackLabel =
    message.feedback?.status === "sent"
      ? "Feedback sent"
      : message.feedback?.status === "queued"
        ? "Saved locally"
        : message.feedback?.status === "failed"
          ? "Feedback saved locally"
          : null;

  const submit = () => {
    if (!ratingDraft) {
      return;
    }

    onSubmitFeedback(message.id, ratingDraft, note.trim() || undefined);
    setRatingDraft(null);
    setNote("");
  };

  return (
    <div className="message-feedback-shell">
      <div className="message-feedback-actions" aria-label="Message actions">
        {durationLabel ? <span className="message-duration">{durationLabel}</span> : null}
        <CopyButton value={message.content} label="Copy" className="message-copy-button" />
        <button
          className={message.feedback?.rating === "like" ? "active" : undefined}
          type="button"
          aria-label="Like this response"
          onClick={() => setRatingDraft("like")}
        >
          <ThumbsUp size={14} />
          <span>Like</span>
        </button>
        <button
          className={message.feedback?.rating === "dislike" ? "active" : undefined}
          type="button"
          aria-label="Dislike this response"
          onClick={() => setRatingDraft("dislike")}
        >
          <ThumbsDown size={14} />
          <span>Dislike</span>
        </button>
        {feedbackLabel ? <span className="message-feedback-status">{feedbackLabel}</span> : null}
      </div>

      {ratingDraft ? (
        <div className="feedback-popover">
          <div>
            <strong>{ratingDraft === "like" ? "What worked well?" : "What should be better?"}</strong>
            <p>Optional. This creates a public GitHub issue without keys, private files, or personal identity.</p>
          </div>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a short note" rows={3} />
          <div className="feedback-popover-actions">
            <button type="button" onClick={() => setRatingDraft(null)}>
              <X size={14} />
              Cancel
            </button>
            <button className="primary-feedback-action" type="button" onClick={submit}>
              <Check size={14} />
              Send feedback
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDuration(durationMs: number | undefined): string | null {
  if (!durationMs || durationMs < 0) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
