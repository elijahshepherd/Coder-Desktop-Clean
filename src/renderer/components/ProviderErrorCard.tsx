import { AlertTriangle } from "lucide-react";
import type { ProviderError } from "../../shared/types";
import { CopyButton } from "./CopyButton";

interface ProviderErrorCardProps {
  error: ProviderError;
  onContinue?: () => void;
  showContinue?: boolean;
}

export function ProviderErrorCard({ error, onContinue, showContinue = false }: ProviderErrorCardProps) {
  const detail = [error.providerLabel, error.model, error.statusCode ? `Status ${error.statusCode}` : ""].filter(Boolean).join(" / ");

  return (
    <section className="provider-error-card expanded">
      <div className="provider-error-summary">
        <span className="provider-error-main">
          <span className="provider-error-icon" aria-hidden="true">
            <AlertTriangle size={15} />
          </span>
          <strong>{error.title}</strong>
        </span>
        <span className="provider-error-meta">
          {detail ? <span>{detail}</span> : null}
        </span>
      </div>
      <div className="provider-error-body">
        <p>{error.message}</p>
        <div className="provider-error-actions">
          <CopyButton value={error.message} label="Copy error" />
          {showContinue && onContinue ? (
            <button className="primary-button" type="button" onClick={onContinue}>
              Continue
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
