import { ChatWorkspace } from "./components/ChatWorkspace";
import { CoderMark } from "./components/CoderMark";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { SubAppsModal } from "./components/SubAppsModal";
import { UpdateNotice } from "./components/UpdateNotice";
import { useCoderDesktopState } from "./hooks/useCoderDesktopState";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { MaintenanceState, PersonalizationSettings } from "../shared/types";

const minSidebarWidth = 212;
const maxSidebarWidth = 340;
const collapsedSidebarWidth = 72;

export function App() {
  const { actions, activeChat, filteredChats, isSending, notice, providerDiagnostics, queuedPrompts, search, sendingChatIds, state, theme } =
    useCoderDesktopState();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSubAppsOpen, setIsSubAppsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(244);
  const [isThemeWaveVisible, setIsThemeWaveVisible] = useState(false);
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme;
  });
  const hasSeenInitialThemeRef = useRef(false);
  const previousThemeRef = useRef(theme);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      setEffectiveTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  // Update effectiveTheme when theme setting changes
  useEffect(() => {
    if (theme !== "system") {
      setEffectiveTheme(theme);
    }
  }, [theme]);

    // Apply theme-dark class to document for CSS logo switching
    useEffect(() => {
      document.documentElement.classList.toggle("theme-dark", effectiveTheme === "dark");
    }, [effectiveTheme]);

  useEffect(() => {
    if (!isSidebarResizing) {
      return undefined;
    }

    const onPointerMove = (event: PointerEvent) => {
      setIsSidebarCollapsed(false);
      setSidebarWidth(Math.min(maxSidebarWidth, Math.max(minSidebarWidth, event.clientX)));
    };

    const onPointerUp = () => setIsSidebarResizing(false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isSidebarResizing]);

  useEffect(() => {
    const reportRendererIssue = (title: string, message: string, stack?: string) => {
      void window.coderDesktop?.reportBug({
        area: "renderer",
        title,
        message,
        severity: "high",
        source: "automatic",
        stack
      });
    };

    const onError = (event: ErrorEvent) => {
      reportRendererIssue(event.error?.name || "Renderer error", event.message, event.error?.stack);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportRendererIssue(
        "Renderer unhandled rejection",
        reason instanceof Error ? reason.message : String(reason),
        reason instanceof Error ? reason.stack : undefined
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const handler = () => setIsSubAppsOpen(true);
    window.addEventListener("sub-apps:open", handler);
    return () => window.removeEventListener("sub-apps:open", handler);
  }, []);

  useEffect(() => {
    if (!state) {
      return undefined;
    }

    if (!hasSeenInitialThemeRef.current) {
      hasSeenInitialThemeRef.current = true;
      previousThemeRef.current = theme;
      return undefined;
    }

    if (previousThemeRef.current === theme) {
      return undefined;
    }

    previousThemeRef.current = theme;
    setIsThemeWaveVisible(false);
    const animationFrame = window.requestAnimationFrame(() => {
      setIsThemeWaveVisible(true);
      window.setTimeout(() => setIsThemeWaveVisible(false), 760);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [state, theme]);

  const resizeSidebar = useCallback(() => {
    if (!isSidebarCollapsed) {
      setIsSidebarResizing(true);
    }
  }, [isSidebarCollapsed]);

  if (!state) {
    return (
      <main className="boot-screen">
        <div className="brand-mark">
          <CoderMark size={18} />
        </div>
        <p className={notice ? "boot-error" : undefined}>{notice ?? "Opening Coder Desktop"}</p>
      </main>
    );
  }

  if (state.maintenance) {
    return <MaintenanceOverlay maintenance={state.maintenance} />;
  }

  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);
  const openSubApps = () => setIsSubAppsOpen(true);
  const closeSubApps = () => setIsSubAppsOpen(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((current) => !current);
  };

  const appStyle = {
    "--sidebar-width": `${isSidebarCollapsed ? collapsedSidebarWidth : sidebarWidth}px`,
    ...createAccentStyle(state.personalization, effectiveTheme)
  } as CSSProperties;

  return (
    <main
      className={`app-shell theme-${effectiveTheme} tone-${state.personalization.accentTone}${isSidebarCollapsed ? " sidebar-collapsed" : ""}${
        isSidebarResizing ? " sidebar-resizing" : ""
      }`}
      style={appStyle}
    >
      {isThemeWaveVisible ? <span className="theme-wave" aria-hidden="true" /> : null}
      <Sidebar
        activeChatId={activeChat?.id ?? ""}
        chats={filteredChats}
        isCollapsed={isSidebarCollapsed}
        pendingChatIds={sendingChatIds}
        search={search}
        onCreateChat={actions.createChat}
        onDeleteChat={actions.deleteChat}
        onResizeStart={resizeSidebar}
        onSearchChange={actions.setSearch}
        onSelectChat={actions.selectChat}
        onOpenSettings={openSettings}
        onToggleCollapse={toggleSidebarCollapse}
      />
      <ChatWorkspace
        chat={activeChat}
        isSending={isSending}
        notice={notice}
        personalization={state.personalization}
        providers={state.providers}
        queuedPrompts={queuedPrompts}
        security={state.security}
        showStarterCard={!state.hasSeenStarterCard && !activeChat && state.chats.length === 0}
        onCancel={actions.cancelActiveChat}
        onCreateChat={actions.createChat}
        onStarterCardSeen={actions.markStarterCardSeen}
        onOpenSettings={openSettings}
        onRemoveQueuedPrompt={(promptId) => {
          if (activeChat) {
            actions.removeQueuedPrompt(activeChat.id, promptId);
          }
        }}
        onResolveApproval={actions.resolveApproval}
        onSend={actions.sendMessage}
        onSecurityChange={actions.updateSecurity}
        onSubmitFeedback={actions.submitMessageFeedback}
      />
      <SubAppsModal isOpen={isSubAppsOpen} onClose={closeSubApps} />
      <SettingsModal
        isOpen={isSettingsOpen}
        aiFunctionality={state.aiFunctionality}
        personalization={state.personalization}
        providerDiagnostics={providerDiagnostics}
        providers={state.providers}
        security={state.security}
        onClose={closeSettings}
        onAiFunctionalityChange={actions.updateAiFunctionality}
        onPersonalizationChange={actions.updatePersonalization}
        onProvidersChange={actions.updateProviders}
        onSecurityChange={actions.updateSecurity}
      />
      {!state.profile.onboardingCompleted ? <OnboardingOverlay onComplete={actions.updateProfile} /> : null}
      <UpdateNotice />
    </main>
  );
}

function MaintenanceOverlay({ maintenance }: { maintenance: MaintenanceState }) {
  return (
    <main className="maintenance-overlay">
      <div className="maintenance-card">
        <span className="maintenance-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <h2>Under maintenance</h2>
        <p className="maintenance-note">{maintenance.note}</p>
        <dl className="maintenance-details">
          <div>
            <dt>ESID</dt>
            <dd>{maintenance.esid}</dd>
          </div>
          <div>
            <dt>OF</dt>
            <dd>{maintenance.of}</dd>
          </div>
          <div>
            <dt>AL</dt>
            <dd>{maintenance.al}</dd>
          </div>
          <div>
            <dt>Issue</dt>
            <dd>#{maintenance.issueNumber}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}

function createAccentStyle(personalization: PersonalizationSettings, theme: "light" | "dark"): CSSProperties {
  if (personalization.accentTone !== "custom") {
    return {};
  }

  const accent = resolveReadableAccent(personalization.customAccentColor, theme);
  const contrast = readableTextForAccent(accent);

  return {
    "--accent": accent,
    "--accent-soft": toRgba(accent, theme === "dark" ? 0.18 : 0.12),
    "--accent-border": toRgba(accent, theme === "dark" ? 0.36 : 0.28),
    "--accent-contrast": contrast
  } as CSSProperties;
}

function resolveReadableAccent(value: string, theme: "light" | "dark"): string {
  const rgb = parseHexColor(value) ?? parseHexColor("#2563eb")!;
  const hsl = rgbToHsl(rgb);
  const safeLightness = theme === "dark" ? Math.max(hsl.l, 58) : Math.min(hsl.l, 42);
  const safeSaturation = Math.min(72, Math.max(hsl.s, 32));
  return hslToHex({ ...hsl, s: safeSaturation, l: safeLightness });
}

function readableTextForAccent(hex: string): "#101114" | "#ffffff" {
  const rgb = parseHexColor(hex) ?? { r: 37, g: 99, b: 235 };
  return relativeLuminance(rgb) > 0.48 ? "#101114" : "#ffffff";
}

function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());

  if (!match) {
    return null;
  }

  const numeric = Number.parseInt(match[1], 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255
  };
}

function toRgba(hex: string, alpha: number): string {
  const rgb = parseHexColor(hex) ?? { r: 37, g: 99, b: 235 };
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return {
    h: hue * 60,
    s: saturation * 100,
    l: lightness * 100
  };
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x]
  ][Math.max(0, Math.min(5, Math.floor(segment)))] ?? [chroma, x, 0];
  const m = lightness - chroma / 2;
  const [r, g, b] = match.map((channel) => Math.round((channel + m) * 255));

  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

