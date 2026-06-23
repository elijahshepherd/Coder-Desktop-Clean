import { describe, expect, it } from "vitest";
import {
  completeWebBatchFetchActivity,
  completeWebSearchActivity,
  detectInternetToolPlan,
  parseInternetToolRequests
} from "./internetToolRequests";

describe("internet tool requests", () => {
  it("parses web search tool requests", () => {
    const plans = parseInternetToolRequests(
      '<coder-tool>{"type":"web-search","query":"official Node.js download","reason":"Find the official installer"}</coder-tool>'
    );

    expect(plans).toHaveLength(1);
    expect(plans[0]?.request).toMatchObject({
      type: "web-search",
      query: "official Node.js download"
    });
    expect(plans[0]?.activity.title).toBe("Searching the web");
  });

  it("parses web fetch tool requests", () => {
    const plans = parseInternetToolRequests(
      '<coder-tool>{"type":"web-fetch","url":"https://example.com","reason":"Read the page"}</coder-tool>'
    );

    expect(plans[0]?.request).toMatchObject({
      type: "web-fetch",
      url: "https://example.com"
    });
    expect(plans[0]?.activity.title).toBe("Reading web page");
  });

  it("parses batch fetch and screen pull tool requests", () => {
    const plans = parseInternetToolRequests(
      [
        '<coder-tool>{"type":"web-batch-fetch","urls":["https://example.com","https://example.org"],"reason":"Read both"}</coder-tool>',
        '<coder-tool>{"type":"web-screen-pull","url":"https://example.com","reason":"Extract elements"}</coder-tool>'
      ].join("\n")
    );

    expect(plans.map((plan) => plan.request.type)).toEqual(["web-batch-fetch", "web-screen-pull"]);
    expect(plans[0]?.activity.title).toBe("Reading web pages");
    expect(plans[1]?.activity.title).toBe("Pulling screen content");
  });

  it("formats completed search results for tool cards", () => {
    const [plan] = parseInternetToolRequests('<coder-tool>{"type":"web-search","query":"docs"}</coder-tool>');
    const completed = completeWebSearchActivity(plan.activity, {
      query: "docs",
      results: [
        {
          title: "Docs",
          url: "https://example.com/docs",
          snippet: "Useful documentation"
        }
      ]
    });

    expect(completed.metrics).toEqual([{ label: "Results", value: "1" }]);
    expect(completed.preview).toContain("Useful documentation");
  });

  it("formats completed batch fetch results", () => {
    const [plan] = parseInternetToolRequests(
      '<coder-tool>{"type":"web-batch-fetch","urls":["https://example.com"],"reason":"Read page"}</coder-tool>'
    );
    const completed = completeWebBatchFetchActivity(plan.activity, {
      pages: [{ title: "Example", url: "https://example.com/", content: "Page content" }]
    });

    expect(completed.metrics).toEqual([{ label: "Pages", value: "1" }]);
    expect(completed.preview).toContain("Page content");
  });

  it("routes quote origin questions into exact web search", () => {
    const plan = detectInternetToolPlan(
      'Where does this line come from: "And I realised what it is. Theres a man... In the back of this plaec"'
    );

    expect(plan?.request.type).toBe("web-search");
    expect(plan?.request.query).toContain('"And I realised what it is. Theres a man... In the back of this plaec"');
    expect(plan?.request.query).toContain("source origin");
  });

  it("does not automatically read a pasted URL unless the user asks to read it", () => {
    expect(detectInternetToolPlan("That's not the right repo, it is https://github.com/elijahshepherd/Coder-Desktop")).toBeNull();

    const plan = detectInternetToolPlan("Read this repo page https://github.com/elijahshepherd/Coder-Desktop");

    expect(plan?.request.type).toBe("web-fetch");
    expect(plan?.request.reason).toBe("Read this repo page");
  });

  it("routes git and GitHub source requests into web search", () => {
    const plan = detectInternetToolPlan("Use git to find where this line comes from in the repository");

    expect(plan?.request.type).toBe("web-search");
    expect(plan?.request.query).toContain("GitHub source code repository");
  });
});
