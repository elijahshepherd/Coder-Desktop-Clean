import { describe, expect, it } from "vitest";
import { extractCoderToolPayloads, stripCoderToolMarkup } from "./coderToolMarkup";

describe("coder tool markup", () => {
  it("extracts closed and escaped tool payloads", () => {
    const payloads = extractCoderToolPayloads(
      '<coder-tool>{"type":"read-file","path":"package.json"}<\\/coder-tool>'
    );

    expect(payloads).toEqual(['{"type":"read-file","path":"package.json"}']);
  });

  it("strips raw tool wrappers and provider tool-call tokens from chat output", () => {
    const output = stripCoderToolMarkup(
      [
        "I will inspect it.",
        '<|tool_calls_section_begin|><coder-tool>{"type":"run-shell","command":"npm test"}</coder-tool><|tool_calls_section_end|>',
        "Done."
      ].join("\n")
    );

    expect(output).toBe("I will inspect it.\n\nDone.");
  });

  it("strips leaked function style tool calls from chat output", () => {
    const output = stripCoderToolMarkup(
      [
        "Let me search.",
        "<tool_call>",
        "<function=web_search>",
        "<parameter=query>PARKERGETAJOB</parameter>",
        "</function>",
        "</tool_call>"
      ].join("\n")
    );

    expect(output).toBe("Let me search.");
  });

  it("strips leaked coding question payloads from visible chat output", () => {
    const output = stripCoderToolMarkup(
      '<coding-questions>{"title":"Search and MD file","questions":[{"id":"topic","question":"What topic?"}]}</coding-questions>'
    );

    expect(output).toBe("");
  });
});
