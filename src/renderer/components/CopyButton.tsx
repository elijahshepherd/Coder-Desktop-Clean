import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface CopyButtonProps {
  value: string;
  label?: string;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
}

export function CopyButton({ value, label = "Copy", compact = false, className = "", disabled = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const resetTimer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(resetTimer);
  }, [copied]);

  const onCopy = useCallback(async () => {
    if (!value || disabled) {
      return;
    }

    try {
      await copyText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [disabled, value]);

  const buttonLabel = copied ? "Copied" : label;

  return (
    <button
      className={`copy-button${compact ? " compact" : ""}${copied ? " copied" : ""}${className ? ` ${className}` : ""}`}
      type="button"
      aria-label={buttonLabel}
      title={buttonLabel}
      disabled={disabled}
      onClick={onCopy}
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {!compact ? <span>{buttonLabel}</span> : null}
    </button>
  );
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the selection-based copy path when clipboard
      // permission is unavailable in preview or locked-down desktop contexts.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was not accepted.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
