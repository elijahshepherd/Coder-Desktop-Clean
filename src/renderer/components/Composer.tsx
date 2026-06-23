import { ArrowUp, Square } from "lucide-react";
import { useState } from "react";

interface ComposerProps {
  disabled: boolean;
  isQueuing?: boolean;
  onCancel: () => void;
  onSend: (content: string) => void;
}

export function Composer({ disabled, isQueuing = false, onCancel, onSend }: ComposerProps) {
  const [content, setContent] = useState("");

  const send = () => {
    const trimmed = content.trim();

    if (!trimmed || disabled) {
      return;
    }

    onSend(trimmed);
    setContent("");
  };

  return (
    <div className="composer">
      <textarea
        value={content}
        disabled={disabled}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
        placeholder="Ask Coder Desktop anything"
        rows={3}
      />
      <button
        className={isQueuing ? "send-button queueing" : "send-button"}
        type="button"
        disabled={disabled || (!isQueuing && !content.trim())}
        onClick={isQueuing && !content.trim() ? onCancel : send}
        aria-label={isQueuing && !content.trim() ? "Stop request" : isQueuing ? "Queue message" : "Send message"}
        title={isQueuing && !content.trim() ? "Stop request" : isQueuing ? "Queue message" : "Send message"}
      >
        {isQueuing && !content.trim() ? <Square size={14} /> : <ArrowUp size={18} />}
      </button>
    </div>
  );
}
