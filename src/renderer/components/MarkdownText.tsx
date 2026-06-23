import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton";

interface MarkdownTextProps {
  content: string;
}

interface FencedBlock {
  type: "code";
  language: string;
  content: string;
}

interface TextBlock {
  type: "text";
  content: string;
}

type MarkdownBlock = FencedBlock | TextBlock;
type TableAlignment = "left" | "center" | "right" | undefined;

interface ParsedTable {
  alignments: TableAlignment[];
  header: string[];
  nextIndex: number;
  rows: string[][];
}

export function MarkdownText({ content }: MarkdownTextProps) {
  return <div className="markdown-content">{parseFencedBlocks(repairText(content)).map(renderBlock)}</div>;
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  if (block.type === "code") {
    return (
      <div className="markdown-code-block" key={`code-${index}`}>
        <div className="markdown-code-toolbar">
          <div className="markdown-code-label">{block.language || "Code"}</div>
          <CopyButton value={block.content} label="Copy code" />
        </div>
        <pre>
          <code>{block.content}</code>
        </pre>
      </div>
    );
  }

  return renderTextBlocks(block.content, `text-${index}`);
}

function parseFencedBlocks(content: string): MarkdownBlock[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/^\\---\s*$/gm, "---");
  const blocks: MarkdownBlock[] = [];
  const fencePattern = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(normalized))) {
    if (match.index > cursor) {
      blocks.push({
        type: "text",
        content: normalized.slice(cursor, match.index)
      });
    }

    blocks.push({
      type: "code",
      language: match[1].trim().slice(0, 32),
      content: trimOneTrailingNewline(match[2])
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < normalized.length) {
    blocks.push({
      type: "text",
      content: normalized.slice(cursor)
    });
  }

  return blocks.length ? blocks : [{ type: "text", content: normalized }];
}

function renderTextBlocks(content: string, keyPrefix: string): ReactNode[] {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);

    if (/^-{3,}$/.test(line.trim())) {
      nodes.push(<div className="markdown-rule" key={`${keyPrefix}-rule-${index}`} aria-hidden="true" />);
      index += 1;
      continue;
    }

    if (heading) {
      nodes.push(
        <div className={`markdown-heading markdown-heading-${heading[1].length}`} key={`${keyPrefix}-heading-${index}`}>
          {renderInline(heading[2], `${keyPrefix}-heading-${index}`)}
        </div>
      );
      index += 1;
      continue;
    }

    const table = readTable(lines, index);

    if (table) {
      nodes.push(renderTable(table, `${keyPrefix}-table-${index}`));
      index = table.nextIndex;
      continue;
    }

    const unorderedItem = /^\s*[-*]\s+(.+)$/.exec(line);

    if (unorderedItem) {
      const items: ReactNode[] = [];

      while (index < lines.length) {
        const item = /^\s*[-*]\s+(.+)$/.exec(lines[index]);

        if (!item) {
          break;
        }

        items.push(<li key={`${keyPrefix}-ul-${index}`}>{renderInline(item[1], `${keyPrefix}-ul-${index}`)}</li>);
        index += 1;
      }

      nodes.push(<ul key={`${keyPrefix}-ul-block-${index}`}>{items}</ul>);
      continue;
    }

    const orderedItem = /^\s*\d+\.\s+(.+)$/.exec(line);

    if (orderedItem) {
      const items: ReactNode[] = [];

      while (index < lines.length) {
        const item = /^\s*\d+\.\s+(.+)$/.exec(lines[index]);

        if (!item) {
          break;
        }

        items.push(<li key={`${keyPrefix}-ol-${index}`}>{renderInline(item[1], `${keyPrefix}-ol-${index}`)}</li>);
        index += 1;
      }

      nodes.push(<ol key={`${keyPrefix}-ol-block-${index}`}>{items}</ol>);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }

      nodes.push(
        <blockquote key={`${keyPrefix}-quote-${index}`}>
          {renderInline(quoteLines.join(" "), `${keyPrefix}-quote-${index}`)}
        </blockquote>
      );
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index]) && !readTable(lines, index)) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    nodes.push(
      <p key={`${keyPrefix}-paragraph-${index}`}>{renderInline(paragraphLines.join(" "), `${keyPrefix}-paragraph-${index}`)}</p>
    );
  }

  return nodes;
}

function renderTable(table: ParsedTable, keyPrefix: string): ReactNode {
  return (
    <div className="markdown-table-wrap" key={keyPrefix}>
      <table className="markdown-table">
        <thead>
          <tr>
            {table.header.map((cell, cellIndex) => (
              <th className={alignmentClass(table.alignments[cellIndex])} key={`${keyPrefix}-header-${cellIndex}`}>
                {renderInline(cell, `${keyPrefix}-header-${cellIndex}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${keyPrefix}-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td className={alignmentClass(table.alignments[cellIndex])} key={`${keyPrefix}-row-${rowIndex}-${cellIndex}`}>
                  {renderInline(cell, `${keyPrefix}-row-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)\s]+)\)|``([^`]+)``|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|(https?:\/\/[^\s<>()]+))/g;
  let cursor = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const key = `${keyPrefix}-inline-${tokenIndex}`;

    if (match[2] && match[3]) {
      const href = safeHref(match[3]);
      nodes.push(href ? <RichLink href={href} key={key} label={match[2]} /> : match[2]);
    } else if (match[4] || match[5]) {
      const codeValue = match[4] || match[5];
      nodes.push(
        <span className="markdown-inline-code" key={key}>
          <code>{codeValue}</code>
          <CopyButton value={codeValue} label="Copy code" compact />
        </span>
      );
    } else if (match[6]) {
      nodes.push(<strong key={key}>{match[6]}</strong>);
    } else if (match[7]) {
      nodes.push(<em key={key}>{match[7]}</em>);
    } else if (match[8]) {
      const href = safeHref(trimTrailingUrlPunctuation(match[8]));
      nodes.push(href ? <RichLink href={href} key={key} label={formatUrlLabel(href)} /> : match[8]);
    }

    cursor = match.index + match[0].length;
    tokenIndex += 1;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function RichLink({ href, label }: { href: string; label: string }) {
  const host = hostForHref(href);

  return (
    <a className="rich-link" href={href} rel="noreferrer" target="_blank">
      {host ? <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`} alt="" /> : null}
      <span>{label || formatUrlLabel(href)}</span>
    </a>
  );
}

function isBlockStart(line: string): boolean {
  return /^(#{1,6})\s+/.test(line) || /^-{3,}$/.test(line.trim()) || /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line) || /^>\s?/.test(line);
}

function readTable(lines: string[], startIndex: number): ParsedTable | null {
  const header = parseTableRow(lines[startIndex]);
  const separators = parseTableRow(lines[startIndex + 1]);

  if (!header || !separators || header.length < 2 || separators.length !== header.length) {
    return null;
  }

  const alignments = separators.map(parseTableAlignment);

  if (alignments.some((alignment) => alignment === null)) {
    return null;
  }

  const rows: string[][] = [];
  let nextIndex = startIndex + 2;

  while (nextIndex < lines.length && lines[nextIndex].trim()) {
    const row = parseTableRow(lines[nextIndex]);

    if (!row || row.length < 2) {
      break;
    }

    rows.push(normalizeTableCells(row, header.length));
    nextIndex += 1;
  }

  return {
    alignments: alignments as TableAlignment[],
    header: normalizeTableCells(header, header.length),
    nextIndex,
    rows
  };
}

function parseTableRow(line: string | undefined): string[] | null {
  if (!line) {
    return null;
  }

  const trimmed = line.trim();

  if (!trimmed.includes("|")) {
    return null;
  }

  const row = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = splitTableCells(row).map((cell) => cell.replace(/\\\|/g, "|").trim());
  return cells.length >= 2 ? cells : null;
}

function splitTableCells(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let isEscaped = false;

  for (const character of row) {
    if (isEscaped) {
      current += character;
      isEscaped = false;
      continue;
    }

    if (character === "\\") {
      current += character;
      isEscaped = true;
      continue;
    }

    if (character === "|") {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

function parseTableAlignment(cell: string): TableAlignment | null {
  const value = cell.trim();

  if (!/^:?-{3,}:?$/.test(value)) {
    return null;
  }

  const startsWithColon = value.startsWith(":");
  const endsWithColon = value.endsWith(":");

  if (startsWithColon && endsWithColon) {
    return "center";
  }

  if (endsWithColon) {
    return "right";
  }

  return startsWithColon ? "left" : undefined;
}

function normalizeTableCells(cells: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_value, index) => cells[index] ?? "");
}

function alignmentClass(alignment: TableAlignment): string | undefined {
  return alignment ? `markdown-table-align-${alignment}` : undefined;
}

function safeHref(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function hostForHref(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function formatUrlLabel(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host.includes("youtube.com") && url.pathname === "/watch") {
      return "YouTube video";
    }

    if (host.includes("youtube.com") && url.pathname.includes("playlist")) {
      return "YouTube playlist";
    }

    if (host.includes("github.com")) {
      const parts = url.pathname.split("/").filter(Boolean).slice(0, 2);
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : "GitHub";
    }

    return host || value;
  } catch {
    return value;
  }
}

function trimTrailingUrlPunctuation(value: string): string {
  return value.replace(/[.,;:!?]+$/u, "");
}

function trimOneTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value.slice(0, -1) : value;
}

function repairText(value: string): string {
  return value
    .replace(/\u00c2\u00a0/g, " ")
    .replace(/\u00e2\u2020\u2019/g, "to")
    .replace(/\u00e2\u20ac\u201d/g, ",")
    .replace(/\u00e2\u20ac\u201c/g, "-")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\u00e2\u20ac\u201d|\u00e2\u20ac\u201c/g, "-")
    .replace(/\u00a0/g, " ");
}
