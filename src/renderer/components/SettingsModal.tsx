import { useEffect } from "react";
import type {
  AiFunctionalitySettings,
  PersonalizationSettings,
  ProviderDiagnostic,
  ProviderSettings,
  SecuritySettings
} from "../../shared/types";
import { appVersion } from "../../shared/version";
import { SettingsPanel } from "./SettingsPanel";

interface SettingsModalProps {
  isOpen: boolean;
  aiFunctionality: AiFunctionalitySettings;
  personalization: PersonalizationSettings;
  providerDiagnostics: ProviderDiagnostic[];
  providers: ProviderSettings;
  security: SecuritySettings;
  onClose: () => void;
  onAiFunctionalityChange: (settings: AiFunctionalitySettings) => void;
  onPersonalizationChange: (personalization: PersonalizationSettings) => void;
  onProvidersChange: (providers: ProviderSettings) => void;
  onSecurityChange: (security: SecuritySettings) => void;
}

export function SettingsModal({
  isOpen,
  aiFunctionality,
  personalization,
  providerDiagnostics,
  providers,
  security,
  onClose,
  onAiFunctionalityChange,
  onPersonalizationChange,
  onProvidersChange,
  onSecurityChange
}: SettingsModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="settings-modal-scrim" role="presentation" onClick={onClose}>
      <section className="settings-modal-card" role="dialog" aria-label="Settings" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="settings-modal-header">
          <div>
            <h2>Settings</h2>
            <p>Providers and safe local behavior</p>
          </div>
          <span className="settings-version-pill">Version {appVersion}</span>
          <button className="settings-close-button" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <SettingsPanel
          aiFunctionality={aiFunctionality}
          diagnostics={providerDiagnostics}
          personalization={personalization}
          providers={providers}
          security={security}
          onAiFunctionalityChange={onAiFunctionalityChange}
          onChange={onProvidersChange}
          onPersonalizationChange={onPersonalizationChange}
          onSecurityChange={onSecurityChange}
        />
      </section>
    </div>
  );
}
