import {
  CheckCircle2,
  ChevronDown,
  FileCode2,
  FileMinus2,
  FilePlus2,
  Files,
  FolderMinus,
  FolderPlus,
  Globe,
  Pencil,
  Search,
  Terminal,
  XCircle
} from "lucide-react";
import { useState } from "react";
import type { ToolActivity, WorkspaceToolActivity } from "../../shared/types";
import { CopyButton } from "./CopyButton";

interface ToolActivityCardProps {
  activity: ToolActivity;
  status?: "complete" | "thinking" | "error";
}

export function ToolActivityCard({ activity, status = "complete" }: ToolActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isThinking = status === "thinking" || !hasCompletedPayload(activity);
  const isError = status === "error" || hasErrorResult(activity);
  const preview = createPreview(activity);
  const summaryCode = getSummaryCode(activity);
  const sources = getActivitySources(activity);
  const metrics = getActivityMetrics(activity);

  return (
    <section className={`tool-card${isThinking ? " thinking" : ""}${isError ? " error" : ""}${isExpanded ? " expanded" : ""}`}>
      <div className="tool-card-orbit" aria-hidden="true" />
      <button
        className="tool-card-summary"
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="tool-card-summary-main">
          <span className="tool-card-icon" aria-hidden="true">
            {isError ? <XCircle size={15} /> : isThinking ? iconForActivity(activity) : completeIconForActivity(activity)}
          </span>
          <strong>{activity.title}</strong>
        </span>
        <span className="tool-card-summary-meta">
          {metrics.length ? (
            <span className="tool-card-metrics">
              {metrics.map((metric) => (
                <span className={metric.tone ? `metric-${metric.tone}` : undefined} key={`${metric.label}-${metric.value}`}>
                  {metric.value}
                </span>
              ))}
            </span>
          ) : null}
          {sources.length ? (
            <span className="source-icon-stack" aria-label="Sources used">
              {sources.slice(0, 4).map((source) => (
                <img key={source.url} src={source.iconUrl} alt="" title={source.host} />
              ))}
            </span>
          ) : null}
          {summaryCode ? <code title={summaryCode}>{summaryCode}</code> : null}
          <ChevronDown className="tool-card-chevron" size={16} aria-hidden="true" />
        </span>
      </button>

      {isExpanded ? (
        <div className="tool-card-details">
          <p>{activity.description}</p>

          {"target" in activity && activity.target ? (
            <span className="tool-card-code-chip">
              <code>{activity.target}</code>
              <CopyButton value={activity.target} label="Copy path" compact />
            </span>
          ) : null}
          {"command" in activity && activity.command ? (
            <span className="tool-card-code-chip">
              <code>{activity.command}</code>
              <CopyButton value={activity.command} label="Copy command" compact />
            </span>
          ) : null}

          {metrics.length ? (
            <div className="tool-card-metrics expanded-metrics">
              {metrics.map((metric) => (
                <span className={metric.tone ? `metric-${metric.tone}` : undefined} key={`${metric.label}-${metric.value}-detail`}>
                  {metric.label} {metric.value}
                </span>
              ))}
            </div>
          ) : null}

          {!isThinking && preview ? (
            <div className="tool-card-output-wrap">
              <CopyButton value={preview} label="Copy output" />
              <pre className="tool-card-output">{preview}</pre>
            </div>
          ) : null}

          {sources.length ? (
            <div className="tool-card-sources">
              {sources.map((source) => (
                <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                  <img src={source.iconUrl} alt="" />
                  <span>{source.host}</span>
                  <small>{source.url}</small>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function completeIconForActivity(activity: ToolActivity) {
  if (activity.kind === "windows-ps-group" || activity.kind === "shell-command") {
    return <CheckCircle2 size={15} />;
  }

  return iconForActivity(activity);
}

function iconForActivity(activity: ToolActivity) {
  if (activity.kind === "windows-ps-group") {
    return <Terminal size={15} />;
  }

  if (activity.kind === "web-search") {
    return <Search size={15} />;
  }

  if (activity.kind === "web-fetch") {
    return <Globe size={15} />;
  }

  if (activity.kind === "web-batch-fetch" || activity.kind === "web-screen-pull") {
    return <Globe size={15} />;
  }

  switch ((activity as WorkspaceToolActivity).kind) {
    case "file-list":
      return <Files size={15} />;
    case "file-read":
      return <FileCode2 size={15} />;
    case "file-count":
      return <Files size={15} />;
    case "file-write":
      return <Pencil size={15} />;
    case "file-create":
      return <FilePlus2 size={15} />;
    case "file-delete":
      return <FileMinus2 size={15} />;
    case "folder-create":
      return <FolderPlus size={15} />;
    case "folder-count":
      return <Files size={15} />;
    case "folder-delete":
      return <FolderMinus size={15} />;
    case "line-count":
      return <FileCode2 size={15} />;
    case "shell-command":
      return <Terminal size={15} />;
    default:
      return <CheckCircle2 size={15} />;
  }
}

function hasCompletedPayload(activity: ToolActivity): boolean {
  if (activity.kind === "windows-ps-group") {
    return Boolean(activity.result);
  }

  if (activity.kind === "web-search" || activity.kind === "web-fetch" || activity.kind === "web-batch-fetch" || activity.kind === "web-screen-pull") {
    return Boolean(activity.preview || activity.results || activity.metrics?.length);
  }

  return Boolean(
    activity.preview ||
      ("diff" in activity && activity.diff) ||
      ("result" in activity && activity.result) ||
      activity.metrics?.length
  );
}

function hasErrorResult(activity: ToolActivity): boolean {
  if ("result" in activity && typeof activity.result?.exitCode === "number") {
    return activity.result.exitCode !== 0;
  }

  return false;
}

function createPreview(activity: ToolActivity): string {
  if (activity.kind === "windows-ps-group") {
    const output = activity.result?.stdout || activity.result?.stderr || "";
    return trimPreview(output);
  }

  return trimPreview(activity.preview ?? "");
}

function getSummaryCode(activity: ToolActivity): string | null {
  if ("command" in activity && activity.command) {
    return activity.command;
  }

  if ("target" in activity && activity.target) {
    return activity.target;
  }

  return null;
}

function getActivitySources(activity: ToolActivity): Array<{ host: string; iconUrl: string; url: string }> {
  if (activity.kind !== "web-search" && activity.kind !== "web-fetch" && activity.kind !== "web-batch-fetch" && activity.kind !== "web-screen-pull") {
    return [];
  }

  const urls =
    activity.kind === "web-search"
      ? activity.results?.map((result) => result.url) ?? []
      : activity.kind === "web-batch-fetch"
        ? activity.urls ?? []
        : activity.url
          ? [activity.url]
          : [];
  const sources: Array<{ host: string; iconUrl: string; url: string }> = [];
  const seen = new Set<string>();

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, "");

      if (seen.has(host)) {
        continue;
      }

      seen.add(host);
      sources.push({
        host,
        iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`,
        url
      });
    } catch {
      continue;
    }
  }

  return sources;
}

function getActivityMetrics(activity: ToolActivity) {
  return "metrics" in activity && activity.metrics ? activity.metrics : [];
}

function trimPreview(value: string): string {
  const clean = value.trim();
  return clean.length > 900 ? `${clean.slice(0, 900)}\n\nOutput was shortened for chat.` : clean;
}
