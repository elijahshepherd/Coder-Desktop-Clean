import { describe, expect, it } from "vitest";
import { createDefaultAiFunctionalitySettings, createDefaultPersonalizationSettings } from "../shared/defaults";
import { applySettingsToolRequest, parseSettingsToolRequests } from "./settingsToolRequests";

describe("settings tool requests", () => {
  it("parses safe settings changes from assistant tool markup", () => {
    const plans = parseSettingsToolRequests(
      [
        '<coder-tool>{"type":"change-settings","theme":"dark","maxLetMeKnows":5,"apiKey":"secret","reason":"Match the current room lighting."}</coder-tool>',
        '<coder-tool>{"type":"delete-files","path":"C:/Users"}</coder-tool>'
      ].join("\n")
    );

    expect(plans).toHaveLength(1);
    expect(plans[0].request).toEqual({
      type: "change-settings",
      theme: "dark",
      maxLetMeKnows: 5,
      reason: "Match the current room lighting."
    });
  });

  it("applies only safe preferences and reports changed settings", () => {
    const result = applySettingsToolRequest(
      {
        type: "change-settings",
        theme: "dark",
        completionAnimation: false,
        completionNotifications: false,
        maxLetMeKnows: 9,
        reason: "Make the workspace quieter."
      },
      createDefaultPersonalizationSettings(),
      createDefaultAiFunctionalitySettings()
    );

    expect(result.changed).toBe(true);
    expect(result.personalization.theme).toBe("dark");
    expect(result.personalization.completionAnimation).toBe(false);
    expect(result.personalization.completionNotifications).toBe(false);
    expect(result.aiFunctionality.maxLetMeKnows).toBe(5);
    expect(result.activity.preview).toContain("Theme: Dark mode");
    expect(result.activity.preview).toContain("Max Let Me Knows: On");
    expect(result.activity.metrics[0]).toEqual({ label: "Changed", value: "4", tone: "added" });
  });
});
