import type { AiFunctionalitySettings, PersonalizationSettings, SettingsToolActivity, ThemeMode, ToolMetric } from "../shared/types";
import { extractCoderToolPayloads } from "./coderToolMarkup";

export interface SettingsToolRequest {
  type: "change-settings";
  theme?: ThemeMode;
  completionAnimation?: boolean;
  completionNotifications?: boolean;
  maxLetMeKnows?: number;
  reason?: string;
}

export interface SettingsToolPlan {
  request: SettingsToolRequest;
  activity: SettingsToolActivity;
}

export interface SettingsToolApplyResult {
  aiFunctionality: AiFunctionalitySettings;
  activity: SettingsToolActivity;
  changed: boolean;
  personalization: PersonalizationSettings;
}

export function parseSettingsToolRequests(content: string): SettingsToolPlan[] {
  const plans: SettingsToolPlan[] = [];

  for (const payload of extractCoderToolPayloads(content)) {
    try {
      const request = normalizeSettingsRequest(JSON.parse(payload) as Record<string, unknown>);

      if (request) {
        plans.push({
          request,
          activity: createSettingsToolActivity(request)
        });
      }
    } catch {
      continue;
    }
  }

  return plans;
}

export function createSettingsToolActivity(request: SettingsToolRequest): SettingsToolActivity {
  return {
    kind: "settings-change",
    title: "Changing settings",
    description: request.reason || "Apply safe preference changes requested in chat.",
    group: "Settings",
    metrics: [{ label: "Status", value: "Pending" }]
  };
}

export function applySettingsToolRequest(
  request: SettingsToolRequest,
  personalization: PersonalizationSettings,
  aiFunctionality: AiFunctionalitySettings
): SettingsToolApplyResult {
  const nextPersonalization: PersonalizationSettings = { ...personalization };
  const nextAiFunctionality: AiFunctionalitySettings = { ...aiFunctionality };
  const changedLabels: string[] = [];

  if (request.theme && nextPersonalization.theme !== request.theme) {
    nextPersonalization.theme = request.theme;
    changedLabels.push(`Theme: ${request.theme === "dark" ? "Dark mode" : "Light mode"}`);
  }

  if (typeof request.completionAnimation === "boolean" && nextPersonalization.completionAnimation !== request.completionAnimation) {
    nextPersonalization.completionAnimation = request.completionAnimation;
    changedLabels.push(`Completion animation: ${request.completionAnimation ? "On" : "Off"}`);
  }

  if (
    typeof request.completionNotifications === "boolean" &&
    nextPersonalization.completionNotifications !== request.completionNotifications
  ) {
    nextPersonalization.completionNotifications = request.completionNotifications;
    changedLabels.push(`Desktop notification: ${request.completionNotifications ? "On" : "Off"}`);
  }

  if (typeof request.maxLetMeKnows === "number") {
    const nextCount = Math.min(5, Math.max(0, Math.round(request.maxLetMeKnows)));

    if (nextAiFunctionality.maxLetMeKnows !== nextCount) {
      nextAiFunctionality.maxLetMeKnows = nextCount;
      changedLabels.push(`Max Let Me Knows: ${nextCount > 0 ? "On" : "Off"}`);
    }
  }

  const changed = changedLabels.length > 0;
  const metrics: ToolMetric[] = [{ label: "Changed", value: String(changedLabels.length), tone: changed ? "added" : "neutral" }];

  return {
    aiFunctionality: nextAiFunctionality,
    activity: {
      kind: "settings-change",
      title: changed ? "Settings changed" : "Settings already matched",
      description: request.reason || "Safe preference changes were checked.",
      group: "Settings",
      preview: changed ? changedLabels.join("\n") : "No settings needed to change.",
      metrics
    },
    changed,
    personalization: nextPersonalization
  };
}

function normalizeSettingsRequest(value: Record<string, unknown>): SettingsToolRequest | null {
  if (value.type !== "change-settings") {
    return null;
  }

  const request: SettingsToolRequest = {
    type: "change-settings"
  };

  if (value.theme === "light" || value.theme === "dark") {
    request.theme = value.theme;
  }

  if (typeof value.completionAnimation === "boolean") {
    request.completionAnimation = value.completionAnimation;
  }

  if (typeof value.completionNotifications === "boolean") {
    request.completionNotifications = value.completionNotifications;
  }

  if (typeof value.maxLetMeKnows === "number" && Number.isFinite(value.maxLetMeKnows)) {
    request.maxLetMeKnows = value.maxLetMeKnows;
  }

  if (typeof value.reason === "string") {
    request.reason = value.reason.trim().slice(0, 240);
  }

  return hasSettingsChange(request) ? request : null;
}

function hasSettingsChange(request: SettingsToolRequest): boolean {
  return (
    Boolean(request.theme) ||
    typeof request.completionAnimation === "boolean" ||
    typeof request.completionNotifications === "boolean" ||
    typeof request.maxLetMeKnows === "number"
  );
}
