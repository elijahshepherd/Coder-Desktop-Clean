import { Bug, Download, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { providerIds, providerLabels } from "../../shared/providers";
import { nvidiaDevelopmentPreset, nvidiaEverydayPreset } from "../../shared/defaults";
import type {
  AccentTone,
  AiFunctionalitySettings,
  PersonalizationSettings,
  ProviderDiagnostic,
  ProviderId,
  ProviderSettings,
  ReasoningEffort,
  SecuritySettings,
  ThemeMode,
  UpdateInfo
} from "../../shared/types";
import { appVersion } from "../../shared/version";
import { desktopApi } from "../api/desktopApi";
import { ProviderMark } from "./ProviderMark";
import { SecurityPanel } from "./SecurityPanel";

type ProviderUpdateKey = "enabled" | "model" | "baseUrl" | "apiKey" | "reasoningEffort" | "imageModel";
type SettingsTab = "providers" | "access" | "personalization" | "ai" | "local";

interface SettingsPanelProps {
  aiFunctionality: AiFunctionalitySettings;
  diagnostics: ProviderDiagnostic[];
  personalization: PersonalizationSettings;
  providers: ProviderSettings;
  security: SecuritySettings;
  onAiFunctionalityChange: (settings: AiFunctionalitySettings) => void;
  onChange: (providers: ProviderSettings) => void | Promise<void>;
  onPersonalizationChange: (personalization: PersonalizationSettings) => void;
  onSecurityChange: (security: SecuritySettings) => void;
}

const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "providers", label: "Providers" },
  { id: "access", label: "Security" },
  { id: "personalization", label: "Personalization" },
  { id: "ai", label: "AI functionality" },
  { id: "local", label: "Local settings" }
];

const toneOptions: Array<{ id: AccentTone; label: string }> = [
  { id: "graphite", label: "Graphite" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "rose", label: "Rose" },
  { id: "custom", label: "Custom" }
];

export function SettingsPanel({
  aiFunctionality,
  diagnostics,
  personalization,
  providers,
  security,
  onAiFunctionalityChange,
  onChange,
  onPersonalizationChange,
  onSecurityChange
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const [draft, setDraft] = useState(providers);
  const [confirmReinstall, setConfirmReinstall] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isManualReportOpen, setIsManualReportOpen] = useState(false);
  const [isSendingManualReport, setIsSendingManualReport] = useState(false);
  const [maintenanceNotice, setMaintenanceNotice] = useState<string | null>(null);
  const [manualReportNote, setManualReportNote] = useState("");
  const [manualUpdate, setManualUpdate] = useState<UpdateInfo | null>(null);
  const [scanningImageProvider, setScanningImageProvider] = useState<ProviderId | null>(null);
  const latestDraftRef = useRef(providers);
  const autoSaveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setDraft((current) => {
      const nextDraft = {
        activeProvider: providers.activeProvider,
        openai: { ...providers.openai, apiKey: current.openai.apiKey ?? "" },
        claude: { ...providers.claude, apiKey: current.claude.apiKey ?? "" },
        nvidia: { ...providers.nvidia, apiKey: current.nvidia.apiKey ?? "" }
      };

      latestDraftRef.current = nextDraft;
      return nextDraft;
    });
  }, [providers]);

  useEffect(() => clearAutoSaveTimer, [clearAutoSaveTimer]);

  const commitProviders = useCallback(
    (nextDraft: ProviderSettings, delayCommit = false) => {
      const normalizedDraft = normalizeExclusiveImageSelection(nextDraft);
      latestDraftRef.current = normalizedDraft;
      setDraft(normalizedDraft);

      if (delayCommit) {
        clearAutoSaveTimer();
        autoSaveTimerRef.current = window.setTimeout(() => {
          autoSaveTimerRef.current = null;
          void onChange(latestDraftRef.current);
        }, 0);
        return;
      }

      clearAutoSaveTimer();
      void onChange(normalizedDraft);
    },
    [clearAutoSaveTimer, onChange]
  );

  const updateProvider = useCallback(
    (provider: ProviderId, key: ProviderUpdateKey, value: string | boolean) => {
      const current = latestDraftRef.current;
      const nextDraft = {
        ...current,
        [provider]: {
          ...current[provider],
          [key]: value
        }
      };

      commitProviders(nextDraft);
    },
    [commitProviders]
  );

  const updateFallbackModel = useCallback(
    (provider: ProviderId, index: number, value: string) => {
      const current = latestDraftRef.current;
      const fallbackModels = [...(current[provider].fallbackModels ?? [])];
      fallbackModels[index] = value;

      const nextDraft = {
        ...current,
        [provider]: {
          ...current[provider],
          fallbackModels
        }
      };

      commitProviders(nextDraft);
    },
    [commitProviders]
  );

  const updateActiveProvider = useCallback(
    (provider: ProviderId) => {
      commitProviders({
        ...latestDraftRef.current,
        activeProvider: provider
      });
    },
    [commitProviders]
  );

  const updatePersonalization = useCallback(
    (next: Partial<PersonalizationSettings>) => {
      onPersonalizationChange({
        ...personalization,
        ...next
      });
    },
    [onPersonalizationChange, personalization]
  );

  const previewTone = useCallback((tone: AccentTone) => {
    const shell = document.querySelector(".app-shell") as HTMLElement | null;
    if (!shell) {
      return;
    }
    if (tone === "custom") {
      return;
    }
    shell.dataset.accentPreview = tone;
  }, []);

  const clearTonePreview = useCallback(() => {
    const shell = document.querySelector(".app-shell") as HTMLElement | null;
    if (!shell) {
      return;
    }
    delete shell.dataset.accentPreview;
  }, []);

  const applyNvidiaPreset = useCallback(
    (preset: "development" | "everyday") => {
      const source =
        preset === "development" ? nvidiaDevelopmentPreset : nvidiaEverydayPreset;
      commitProviders({
        ...draft,
        nvidia: {
          ...draft.nvidia,
          model: source.model,
          fallbackModels: [...(source.fallbackModels ?? [])],
          reasoningEffort: source.reasoningEffort
        }
      });
      updatePersonalization({ nvidiaPreset: preset });
    },
    [commitProviders, draft, updatePersonalization]
  );

  const updateAiFunctionality = useCallback(
    (next: Partial<AiFunctionalitySettings>) => {
      onAiFunctionalityChange({
        ...aiFunctionality,
        ...next,
        maxLetMeKnows: clampLetMeKnowCount(next.maxLetMeKnows ?? aiFunctionality.maxLetMeKnows)
      });
    },
    [aiFunctionality, onAiFunctionalityChange]
  );

  const checkForUpdates = useCallback(async () => {
    setIsCheckingUpdate(true);
    setMaintenanceNotice(null);

    try {
      const update = await desktopApi.checkForUpdate();
      setManualUpdate(update);
      setMaintenanceNotice(update ? `Version ${update.latestVersion} is available.` : "No new versions.");
    } catch (error) {
      setMaintenanceNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const installManualUpdate = useCallback(async () => {
    setMaintenanceNotice("Preparing the update.");

    try {
      const result = await desktopApi.installUpdate();
      setMaintenanceNotice(result.message);
    } catch (error) {
      setMaintenanceNotice(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const scanImageModels = useCallback(async (provider: ProviderId) => {
    setScanningImageProvider(provider);

    try {
      const nextState = await desktopApi.scanImageModels(provider);
      setDraft(nextState.providers);
      latestDraftRef.current = nextState.providers;
    } catch (error) {
      setMaintenanceNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setScanningImageProvider(null);
    }
  }, []);

  const resetLocalData = useCallback(async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setConfirmReinstall(false);
      setMaintenanceNotice("Click reset local data again to clear chats, settings, and saved keys.");
      return;
    }

    await desktopApi.resetLocalData();
    setConfirmReset(false);
    setMaintenanceNotice("Local data was reset.");
  }, [confirmReset]);

  const reinstallCurrentVersion = useCallback(async () => {
    if (!confirmReinstall) {
      setConfirmReinstall(true);
      setConfirmReset(false);
      setMaintenanceNotice("Click reset and reopen again to clear local data and reopen Coder Desktop.");
      return;
    }

    await desktopApi.resetLocalData();
    const message = await desktopApi.reinstallCurrentVersion();
    setMaintenanceNotice(message);
  }, [confirmReinstall]);

  const sendManualBugReport = useCallback(async () => {
    setIsSendingManualReport(true);
    setMaintenanceNotice(null);

    try {
      const result = await desktopApi.reportBug({
        area: "manual report",
        title: "Manual bug report from settings",
        message: manualReportNote.trim() || "The user opened a manual bug report from settings without adding extra notes.",
        severity: "medium",
        source: "manual",
        metadata: {
          appVersion,
          activeProvider: draft.activeProvider,
          openaiEnabled: draft.openai.enabled,
          claudeEnabled: draft.claude.enabled,
          nvidiaEnabled: draft.nvidia.enabled
        }
      });
      const notice =
        result.status === "sent"
          ? "Bug report sent. Thank you."
          : result.status === "skipped"
            ? "Already filed today. Thank you."
            : result.status === "failed"
              ? "Could not file the report. Try again in a moment."
              : result.status === "queued"
                ? "Saved locally. Will retry the next time the app talks to GitHub."
                : result.message;
      setMaintenanceNotice(notice);
      if (result.status === "sent" || result.status === "queued" || result.status === "skipped") {
        setManualReportNote("");
        setIsManualReportOpen(false);
      }
    } catch (error) {
      setMaintenanceNotice("Could not file the report. Try again in a moment.");
    } finally {
      setIsSendingManualReport(false);
    }
  }, [draft.activeProvider, draft.claude.enabled, draft.nvidia.enabled, draft.openai.enabled, manualReportNote]);

  return (
    <section className="tool-panel settings-root">
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {settingsTabs.map((tab) => {
          const isSelected = activeTab === tab.id;

          return (
            <button
              className={isSelected ? "settings-tab active" : "settings-tab"}
              type="button"
              role="tab"
              aria-selected={isSelected}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="settings-tab-content">
        {activeTab === "providers" ? (
          <section className="settings-section" aria-label="Providers">
            <div className="panel-heading">
              <div>
                <h3>Providers</h3>
                <p>Provider keys and model defaults</p>
              </div>
            </div>

            <div className="settings-stack provider-settings-grid">
              {providerIds.map((provider) => (
                <div className={draft.activeProvider === provider ? "provider-card active" : "provider-card"} key={provider}>
                  {diagnostics.find((diagnostic) => diagnostic.provider === provider && diagnostic.status !== "ok") ? (
                    <ProviderDiagnosticNotice
                      diagnostic={diagnostics.find((diagnostic) => diagnostic.provider === provider && diagnostic.status !== "ok")!}
                    />
                  ) : null}
                  <div className="provider-card-heading">
                    <button
                      className="provider-choice"
                      type="button"
                      aria-pressed={draft.activeProvider === provider}
                      onClick={() => updateActiveProvider(provider)}
                    >
                      <ProviderMark provider={provider} />
                      <span>{providerLabels[provider]}</span>
                      {draft.activeProvider === provider ? <span className="primary-provider-label">Primary provider</span> : null}
                    </button>
                    <button
                      className={draft[provider].enabled ? "control-switch active" : "control-switch"}
                      type="button"
                      role="switch"
                      aria-checked={draft[provider].enabled}
                      onClick={() => updateProvider(provider, "enabled", !draft[provider].enabled)}
                    >
                      <span aria-hidden="true" />
                      <span>Enabled</span>
                    </button>
                  </div>

                  <label className="field">
                    <span>API key</span>
                    <input
                      type="password"
                      value={draft[provider].apiKey ?? ""}
                      onChange={(event) => updateProvider(provider, "apiKey", event.target.value)}
                      placeholder={draft[provider].hasApiKey ? "Saved locally" : "Paste a new API key"}
                    />
                  </label>
                  {provider === "nvidia" ? (
                    <div className="field nvidia-preset-field">
                      <span>Model presets</span>
                      <div className="nvidia-preset-options" role="group" aria-label="NVIDIA model presets">
                        <button
                          className={personalization.nvidiaPreset === "development" ? "nvidia-preset-option active" : "nvidia-preset-option"}
                          type="button"
                          aria-pressed={personalization.nvidiaPreset === "development"}
                          onClick={() => applyNvidiaPreset("development")}
                        >
                          <strong>Development models</strong>
                          <small>minimaxai/minimax-m3 primary, m2.7 second, deepseek-v4-flash fallback</small>
                        </button>
                        <button
                          className={personalization.nvidiaPreset === "everyday" ? "nvidia-preset-option active" : "nvidia-preset-option"}
                          type="button"
                          aria-pressed={personalization.nvidiaPreset === "everyday"}
                          onClick={() => applyNvidiaPreset("everyday")}
                        >
                          <strong>Everyday models</strong>
                          <small>gpt-oss-120b primary, step-3.5-flash second, gpt-oss-20b fallback</small>
                        </button>
                        <button
                          className={personalization.nvidiaPreset === "manual" ? "nvidia-preset-option active" : "nvidia-preset-option"}
                          type="button"
                          aria-pressed={personalization.nvidiaPreset === "manual"}
                          onClick={() => updatePersonalization({ nvidiaPreset: "manual" })}
                        >
                          <strong>Custom</strong>
                          <small>Use whatever you typed above</small>
                        </button>
                      </div>
                      <p className="preference-warning">
                        These presets are user suggestions. Account access for each model depends on the API key you saved.
                      </p>
                    </div>
                  ) : null}
                  <label className="field">
                    <span>Model</span>
                    <input value={draft[provider].model} onChange={(event) => updateProvider(provider, "model", event.target.value)} />
                  </label>
                  {supportsReasoningControls(draft[provider].model) ? (
                    <div className="field reasoning-field">
                      <span>Reasoning</span>
                      <div className="reasoning-options" role="group" aria-label={`${providerLabels[provider]} reasoning effort`}>
                        {(["none", "low", "medium", "high"] as ReasoningEffort[]).map((effort) => (
                          <button
                            className={draft[provider].reasoningEffort === effort ? "reasoning-option active" : "reasoning-option"}
                            key={effort}
                            type="button"
                            onClick={() => updateProvider(provider, "reasoningEffort", effort)}
                          >
                            {formatReasoningEffort(effort)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="field fallback-field">
                    <span>Fallback models</span>
                    {[0, 1, 2].map((index) => (
                      <input
                        key={`${provider}-fallback-${index}`}
                        value={draft[provider].fallbackModels?.[index] ?? ""}
                        onChange={(event) => updateFallbackModel(provider, index, event.target.value)}
                        placeholder={index === 0 ? "First fallback model" : `Fallback model ${index + 1}`}
                      />
                    ))}
                  </div>
                  <label className="field">
                    <span>Base URL</span>
                    <input value={draft[provider].baseUrl} onChange={(event) => updateProvider(provider, "baseUrl", event.target.value)} />
                  </label>
                  <section className="image-model-panel" aria-label={`${providerLabels[provider]} image models`}>
                    <div className="image-model-panel-heading">
                      <div>
                        <h4>Image generation</h4>
                        <p>
                          {provider === "nvidia"
                            ? draft[provider].imageModelScan?.message ?? "Scan this provider before generating images."
                            : "Image generation is available through NVIDIA FLUX models."}
                        </p>
                      </div>
                      {provider === "nvidia" ? (
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={scanningImageProvider === provider}
                          onClick={() => void scanImageModels(provider)}
                        >
                          {scanningImageProvider === provider ? "Scanning image models" : "Scan image models"}
                        </button>
                      ) : null}
                    </div>
                    {draft[provider].imageModels?.length ? (
                      <div className="image-model-options" role="group" aria-label={`${providerLabels[provider]} image model choices`}>
                        {draft[provider].imageModels?.map((model) => {
                          const canSelectImageModel = provider === "nvidia";
                          const isSelected = canSelectImageModel && draft[provider].imageModel === model.id;

                          return (
                            <button
                              className={isSelected ? "image-model-option active" : "image-model-option"}
                              disabled={!canSelectImageModel}
                              key={`${provider}-${model.id}`}
                              type="button"
                              onClick={() => updateProvider(provider, "imageModel", model.id)}
                            >
                              <span>{model.label}</span>
                              <small>{formatImageModelQuality(model.quality)}</small>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="image-model-empty">No image models for this provider.</p>
                    )}
                  </section>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "access" ? <SecurityPanel security={security} onChange={onSecurityChange} embedded /> : null}

        {activeTab === "personalization" ? (
          <section className="settings-section" aria-label="Personalization">
            <div className="panel-heading">
              <div>
                <h3>Personalization</h3>
                <p>Visual tone and completion feedback</p>
              </div>
            </div>
            <div className="preference-grid personalization-grid">
              <section className="preference-card personalization-theme-card">
                <div>
                  <h4>Theme</h4>
                  <p>Choose how the app and logo contrast.</p>
                </div>
                <div className="theme-options" role="group" aria-label="Theme">
                  {(["light", "dark"] as ThemeMode[]).map((mode) => {
                    const isSelected = personalization.theme === mode;

                    return (
                      <button
                        className={isSelected ? `theme-option ${mode} active` : `theme-option ${mode}`}
                        key={mode}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => updatePersonalization({ theme: mode })}
                      >
                        <span>{mode === "light" ? "Light mode" : "Dark mode"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="preference-card personalization-tone-card">
                <div className="tone-card-heading">
                  <div>
                    <h4>Button tone</h4>
                    <p>Hover to preview. Click to apply to buttons, fields, shimmers, and progress.</p>
                  </div>
                </div>
                <div className="tone-options" role="group" aria-label="Button tone">
                  {toneOptions.map((tone) => (
                    <button
                      className={personalization.accentTone === tone.id ? `tone-option tone-${tone.id} active` : `tone-option tone-${tone.id}`}
                      key={tone.id}
                      type="button"
                      aria-pressed={personalization.accentTone === tone.id}
                      onMouseEnter={() => previewTone(tone.id)}
                      onFocus={() => previewTone(tone.id)}
                      onMouseLeave={clearTonePreview}
                      onBlur={clearTonePreview}
                      onClick={() => updatePersonalization({ accentTone: tone.id })}
                    >
                      <strong>{tone.label}</strong>
                    </button>
                  ))}
                </div>
                <label className="custom-color-row">
                  <span>Accent color</span>
                  <span className="color-picker-control">
                    <span>Choose color</span>
                    <input
                      aria-label="Custom accent color"
                      type="color"
                      value={normalizeHexColor(personalization.customAccentColor)}
                      onChange={(event) =>
                        updatePersonalization({
                          accentTone: "custom",
                          customAccentColor: normalizeHexColor(event.target.value)
                        })
                      }
                    />
                  </span>
                </label>
              </section>
              <section className="preference-card personalization-feedback-card">
                <div>
                  <h4>Completion feedback</h4>
                  <p>Control what happens when a response finishes.</p>
                </div>
                <PermissionButton
                  checked={personalization.completionAnimation}
                  title="Animate finished cards"
                  onChange={(value) => updatePersonalization({ completionAnimation: value })}
                />
                <PermissionButton
                  checked={personalization.completionNotifications}
                  title="Show desktop notification"
                  onChange={(value) => updatePersonalization({ completionNotifications: value })}
                />
              </section>
              <section className="preference-card personalization-ai-card">
                <div>
                  <h4>AI behavior</h4>
                  <p>Controls that change how the AI uses images and tools.</p>
                </div>
                <PermissionButton
                  checked={personalization.autonomousImageGeneration}
                  title="Let the AI generate images on its own"
                  onChange={(value) => updatePersonalization({ autonomousImageGeneration: value })}
                />
                <PermissionButton
                  checked={personalization.autoAcceptImageGeneration}
                  title="Auto-accept image generation requests"
                  onChange={(value) => updatePersonalization({ autoAcceptImageGeneration: value })}
                  warning="When enabled, AI can trigger image generation without asking for permission each time. This can cause the tool to be used repeatedly. You are responsible for the model and cost usage."
                />
                <PermissionButton
                  checked={personalization.autoUpscaleGeneratedImages}
                  title="Auto-upscale generated images 4x when the model supports it"
                  onChange={(value) => updatePersonalization({ autoUpscaleGeneratedImages: value })}
                />
                <PermissionButton
                  checked={personalization.autoCollapseImageCards}
                  title="Collapse image cards unless opened"
                  onChange={(value) => updatePersonalization({ autoCollapseImageCards: value })}
                />
              </section>
              <section className="preference-card personalization-data-card">
                <div>
                  <h4>Local data</h4>
                  <p>What to do when a new version of Coder Desktop is installed.</p>
                </div>
                <PermissionButton
                  checked={personalization.clearLocalDataOnVersionUpdate}
                  title="Wipe all local chats, settings, and download cache on the next version update"
                  onChange={(value) => updatePersonalization({ clearLocalDataOnVersionUpdate: value })}
                />
              </section>
            </div>
          </section>
        ) : null}

        {activeTab === "ai" ? (
          <section className="settings-section" aria-label="AI functionality">
            <div className="panel-heading">
              <div>
                <h3>AI functionality</h3>
                <p>Conversation behavior and clarification controls</p>
              </div>
            </div>
            <section className="preference-card ai-card">
              <div className="let-me-know-card-heading">
                <div>
                  <h4>Max Let Me Knows</h4>
                  <p>{aiFunctionality.maxLetMeKnows > 0 ? "On" : "Off"}</p>
                </div>
                <button
                  className={aiFunctionality.maxLetMeKnows > 0 ? "control-switch active" : "control-switch"}
                  type="button"
                  role="switch"
                  aria-checked={aiFunctionality.maxLetMeKnows > 0}
                  onClick={() => updateAiFunctionality({ maxLetMeKnows: aiFunctionality.maxLetMeKnows > 0 ? 0 : 5 })}
                >
                  <span aria-hidden="true" />
                  <span>{aiFunctionality.maxLetMeKnows > 0 ? "On" : "Off"}</span>
                </button>
              </div>
              <p className="preference-warning">
                When this is on, the AI asks Let Me Know questions instead of inferring missing details. It will pause more often
                and wait for your choice before acting.
              </p>
            </section>
          </section>
        ) : null}

        {activeTab === "local" ? (
          <section className="local-settings-card" aria-label="Local settings">
            <div>
              <h3>Local settings</h3>
              <p>Manage stored chats, saved provider keys, and updates on this computer.</p>
            </div>
            <div className="local-settings-actions">
              <button className="secondary-button" type="button" disabled={isCheckingUpdate} onClick={checkForUpdates}>
                <RefreshCw size={15} />
                {isCheckingUpdate ? "Checking updates" : "Check for updates"}
              </button>
              <button className="secondary-button" type="button" onClick={() => setIsManualReportOpen((current) => !current)}>
                <Bug size={15} />
                Report bug
              </button>
              {manualUpdate ? (
                <button className="primary-button" type="button" onClick={installManualUpdate}>
                  <Download size={15} />
                  Click here to install {manualUpdate.latestVersion}
                </button>
              ) : null}
              <button className={confirmReset ? "secondary-button danger-action" : "secondary-button"} type="button" onClick={resetLocalData}>
                <Trash2 size={15} />
                Reset local data
              </button>
              <button
                className={confirmReinstall ? "secondary-button danger-action" : "secondary-button"}
                type="button"
                onClick={reinstallCurrentVersion}
              >
                <RotateCcw size={15} />
                Reset and reopen
              </button>
            </div>
            {isManualReportOpen ? (
              <div className="manual-report-form">
                <label className="field">
                  <span>Optional report note</span>
                  <textarea
                    value={manualReportNote}
                    onChange={(event) => setManualReportNote(event.target.value)}
                    placeholder="Describe what happened, what you clicked, or what you expected."
                    rows={4}
                  />
                </label>
                <div className="manual-report-actions">
                  <p>Creates a public GitHub issue with sanitized system details and recent report logs.</p>
                  <button className="primary-button" type="button" disabled={isSendingManualReport} onClick={sendManualBugReport}>
                    {isSendingManualReport ? "Sending report" : "Send bug report"}
                  </button>
                </div>
              </div>
            ) : null}
            {maintenanceNotice ? <p className="local-settings-notice">{maintenanceNotice}</p> : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}

function ProviderDiagnosticNotice({ diagnostic }: { diagnostic: ProviderDiagnostic }) {
  return (
    <div className={`provider-diagnostic ${diagnostic.status}`} role="status">
      <span>{diagnostic.message}</span>
    </div>
  );
}

function PermissionButton({
  checked,
  title,
  onChange,
  warning
}: {
  checked: boolean;
  title: string;
  onChange: (value: boolean) => void;
  warning?: string;
}) {
  return (
    <button
      className={checked ? "permission-switch active compact" : "permission-switch compact"}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span>
        <strong>{title}</strong>
        {warning ? <p className="preference-warning">{warning}</p> : null}
      </span>
    </button>
  );
}

function normalizeExclusiveImageSelection(providers: ProviderSettings): ProviderSettings {
  const activeProvider = providers.activeProvider;
  const next = {
    activeProvider,
    openai: { ...providers.openai },
    claude: { ...providers.claude },
    nvidia: { ...providers.nvidia }
  };

  for (const provider of providerIds) {
    const selectedModel = provider === "nvidia" ? next[provider].imageModel || next[provider].imageModels?.[0]?.id || "" : "";
    next[provider] = {
      ...next[provider],
      imageModel: selectedModel,
      imageModelScan: next[provider].imageModelScan
        ? {
            ...next[provider].imageModelScan,
            selectedModel: selectedModel || undefined
          }
        : next[provider].imageModelScan
    };
  }

  return next;
}

function supportsReasoningControls(model: string): boolean {
  return /\b(o[134]|gpt-5|gpt-oss|reasoning|deepseek|qwen|qwq)\b/i.test(model);
}

function formatReasoningEffort(effort: ReasoningEffort): string {
  switch (effort) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "none":
    default:
      return "None";
  }
}

function formatImageModelQuality(quality: "fast" | "balanced" | "quality"): string {
  switch (quality) {
    case "fast":
      return "Fast";
    case "quality":
      return "Quality";
    case "balanced":
    default:
      return "Balanced";
  }
}

function clampLetMeKnowCount(value: number): number {
  return Math.min(5, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

function normalizeHexColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : "#2563eb";
}
