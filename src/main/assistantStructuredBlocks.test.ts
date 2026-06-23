import { describe, expect, it } from "vitest";
import { parseAssistantStructuredBlocks, stripAssistantStructuredBlocks } from "./assistantStructuredBlocks";

describe("assistant structured blocks", () => {
  it("parses todo progress cards from assistant responses", () => {
    const blocks = parseAssistantStructuredBlocks(
      '<coder-progress>{"title":"Build release","items":[{"id":"ui","title":"Build the UI","status":"active"},{"id":"test","title":"Run tests","status":"pending"}]}</coder-progress>'
    );

    expect(blocks.hadBlocks).toBe(true);
    expect(blocks.progress[0]?.items).toHaveLength(2);
    expect(blocks.progress[0]?.items[0]).toMatchObject({
      title: "Build the UI",
      status: "active"
    });
  });

  it("parses clarification questions with a recommended option", () => {
    const blocks = parseAssistantStructuredBlocks(
      '<coder-questions>{"title":"Let me know","questions":[{"id":"color","question":"What color should I use?","options":[{"id":"calm","label":"Calm neutral colors"},{"id":"blue","label":"Blue and black"}]}]}</coder-questions>'
    );

    expect(blocks.questionSets[0]?.questions[0]?.options[0]).toMatchObject({
      label: "Calm neutral colors",
      recommended: true
    });
  });

  it("strips structured blocks from final chat text", () => {
    expect(stripAssistantStructuredBlocks("Hello\n<coder-progress>{\"items\":[]}</coder-progress>\nDone")).toBe("Hello\n\nDone");
  });
});
