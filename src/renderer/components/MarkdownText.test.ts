import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownText } from "./MarkdownText";

describe("MarkdownText copy controls", () => {
  it("adds copy buttons for single, double, and fenced code", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownText, {
        content: [
          "Use `single-copy` and ``double-copy``.",
          "",
          "```ts",
          "const blockCopy = 'block-copy';",
          "```"
        ].join("\n")
      })
    );

    expect(markup).toContain("single-copy");
    expect(markup).toContain("double-copy");
    expect(markup).toContain("block-copy");
    expect(markup.match(/aria-label=\"Copy code\"/g)).toHaveLength(3);
  });
});

describe("MarkdownText tables", () => {
  it("renders pipe tables with alignment and inline markdown", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownText, {
        content: [
          "| Name | Status | Count |",
          "| :--- | :---: | ---: |",
          "| `api` | **Ready** | 12 |",
          "| Docs | [Open](https://example.com) | 3 |"
        ].join("\n")
      })
    );

    expect(markup).toContain('<div class="markdown-table-wrap">');
    expect(markup).toContain("<table");
    expect(markup).toContain('class="markdown-table-align-left"');
    expect(markup).toContain('class="markdown-table-align-center"');
    expect(markup).toContain('class="markdown-table-align-right"');
    expect(markup).toContain("<strong>Ready</strong>");
    expect(markup).toContain('href="https://example.com"');
    expect(markup).toContain("api");
  });

  it("keeps escaped pipes inside table cells", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownText, {
        content: ["| Value | Notes |", "| --- | --- |", "| Left \\| right | Kept together |"].join("\n")
      })
    );

    expect(markup).toContain("Left | right");
    expect(markup).toContain("Kept together");
  });
});
