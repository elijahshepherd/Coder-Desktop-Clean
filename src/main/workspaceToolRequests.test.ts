import { describe, expect, it } from "vitest";
import {
  completeDiffActivity,
  detectWorkspaceToolPlans,
  formatToolActivityContent,
  parseWorkspaceToolRequest,
  parseWorkspaceToolRequests
} from "./workspaceToolRequests";

describe("workspace tool requests", () => {
  it("parses read file requests from coder tool XML", () => {
    const plan = parseWorkspaceToolRequest(
      '<coder-tool>{"type":"read-file","path":"src/App.tsx","reason":"Inspect the component"}</coder-tool>'
    );

    expect(plan?.request).toMatchObject({
      type: "read-file",
      path: "src/App.tsx"
    });
    expect(plan?.activity.title).toBe("Reading App.tsx");
  });

  it("parses write file requests with full replacement content", () => {
    const plan = parseWorkspaceToolRequest(
      '<coder-tool>{"type":"write-file","path":"src/styles.css","content":".app { color: red; }"}</coder-tool>'
    );

    expect(plan?.request.content).toContain("color: red");
    expect(plan?.activity.title).toBe("Editing styles.css");
  });

  it("rejects incomplete or unknown requests", () => {
    expect(parseWorkspaceToolRequest('<coder-tool>{"type":"read-file"}</coder-tool>')).toBeNull();
    expect(parseWorkspaceToolRequest('<coder-tool>{"type":"delete-project","path":"src"}</coder-tool>')).toBeNull();
  });

  it("parses multiple workspace tool requests from one provider response", () => {
    const plans = parseWorkspaceToolRequests(
      [
        '<coder-tool>{"type":"read-file","path":"package.json","reason":"Check scripts"}</coder-tool>',
        '<coder-tool>{"type":"run-shell","command":"npm test","reason":"Verify the project"}</coder-tool>'
      ].join("\n")
    );

    expect(plans.map((plan) => plan.request.type)).toEqual(["read-file", "run-shell"]);
    expect(plans[1]?.activity.title).toBe("Running shell command");
  });

  it("parses count tool requests", () => {
    const plans = parseWorkspaceToolRequests(
      [
        '<coder-tool>{"type":"count-files","path":"src","reason":"Count files"}</coder-tool>',
        '<coder-tool>{"type":"count-folders","path":"src","reason":"Count folders"}</coder-tool>',
        '<coder-tool>{"type":"count-lines","path":"src","reason":"Count lines"}</coder-tool>'
      ].join("\n")
    );

    expect(plans.map((plan) => plan.request.type)).toEqual(["count-files", "count-folders", "count-lines"]);
    expect(plans.map((plan) => plan.activity.title)).toEqual(["Counting files", "Counting folders", "Counting lines"]);
  });

  it("detects explicit Windows project folders for direct inspection", () => {
    const plans = detectWorkspaceToolPlans("Add another feature to my game at C:\\Users\\Elijah (General)\\Downloads\\Development\\Starland");

    expect(plans[0]?.request).toMatchObject({
      type: "list-files",
      path: "C:\\Users\\Elijah (General)\\Downloads\\Development\\Starland"
    });
    expect(plans[0]?.activity.description).toContain("Starland");
  });

  it("detects Windows paths that use forward slashes", () => {
    const plans = detectWorkspaceToolPlans("Please inspect C:/Users/Elijah (General)/Desktop/flowers.html");

    expect(plans[0]?.request).toMatchObject({
      type: "read-file",
      path: "C:/Users/Elijah (General)/Desktop/flowers.html"
    });
  });

  it("detects MIT license creation in an explicit Windows folder", () => {
    const plans = detectWorkspaceToolPlans("create a md file for lisecnec mit in C:\\Users\\Elijah (General)\\Downloads\\Development\\Starland");

    expect(plans.some((plan) => plan.request.type === "create-file" && plan.request.path?.endsWith("LICENSE.md"))).toBe(true);
    expect(plans.find((plan) => plan.request.type === "create-file")?.request.content).toContain("MIT License");
  });

  it("formats diff activity with added and removed metrics", () => {
    const plan = parseWorkspaceToolRequest(
      '<coder-tool>{"type":"write-file","path":"src/styles.css","content":".next {}"}</coder-tool>'
    );

    expect(plan).not.toBeNull();

    const activity = completeDiffActivity(plan!.activity, {
      path: "src/styles.css",
      lines: [
        { id: "1", type: "removed", value: ".old {}\n" },
        { id: "2", type: "added", value: ".next {}\n" }
      ]
    });

    expect(activity.metrics).toEqual([
      { label: "Added", value: "+1", tone: "added" },
      { label: "Removed", value: "-1", tone: "removed" }
    ]);
    expect(formatToolActivityContent(activity)).toContain("Tool activity: Edited styles.css");
  });
});
