import { describe, expect, it } from "vitest";
import {
  createWindowsPowerShellActivity,
  detectWindowsPowerShellPlan,
  formatWindowsPowerShellToolContent,
  parseWindowsPowerShellToolRequest,
  parseWindowsPowerShellToolRequests
} from "./windowsPowerShellTools";

describe("Windows PowerShell command grouping", () => {
  it("maps system information requests to systeminfo", () => {
    const plan = detectWindowsPowerShellPlan("What processor and memory does this computer have?");

    expect(plan?.command).toBe("systeminfo");
    expect(plan?.activity.title).toBe("Getting system information");
    expect(plan?.activity.kind).toBe("windows-ps-group");
  });

  it("accepts direct approved information commands", () => {
    const plan = detectWindowsPowerShellPlan("run ipconfig all");

    expect(plan?.command).toBe("ipconfig /all");
    expect(plan?.activity.title).toBe("Checking network configuration");
  });

  it("does not auto-run destructive commands from the pasted command catalog", () => {
    expect(detectWindowsPowerShellPlan("run shutdown")).toBeNull();
    expect(detectWindowsPowerShellPlan("run remove-item")).toBeNull();
    expect(parseWindowsPowerShellToolRequest('<coder-tool>{"type":"windows-ps-group","command":"format"}</coder-tool>')).toBeNull();
  });

  it("parses provider tool requests for approved commands", () => {
    const plan = parseWindowsPowerShellToolRequest(
      '<coder-tool>{"type":"windows-ps-group","command":"systeminfo","reason":"Read processor details"}</coder-tool>'
    );

    expect(plan?.command).toBe("systeminfo");
  });

  it("parses multiple approved provider information commands", () => {
    const plans = parseWindowsPowerShellToolRequests(
      [
        '<coder-tool>{"type":"windows-ps-group","command":"systeminfo"}</coder-tool>',
        '<coder-tool>{"type":"windows-ps-group","command":"whoami"}</coder-tool>'
      ].join("\n")
    );

    expect(plans.map((plan) => plan.command)).toEqual(["systeminfo", "whoami"]);
  });

  it("formats completed tool results for compact provider context", () => {
    const activity = createWindowsPowerShellActivity("systeminfo", {
      command: "systeminfo",
      cwd: "C:\\Demo",
      exitCode: 0,
      stdout: "Processor(s): 1 Processor(s) Installed.",
      stderr: "",
      durationMs: 120
    });

    expect(formatWindowsPowerShellToolContent(activity)).toContain("Got system information");
    expect(formatWindowsPowerShellToolContent(activity)).toContain("Processor");
    expect(formatWindowsPowerShellToolContent(activity)).not.toContain("ms");
  });
});
