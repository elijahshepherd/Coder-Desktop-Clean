import { CheckCircle2, Loader2, Terminal, XCircle } from "lucide-react";
import type { WindowsPowerShellActivity } from "../../shared/types";
import { CopyButton } from "./CopyButton";

interface WindowsPowerShellCardProps {
  activity: WindowsPowerShellActivity;
  status?: "complete" | "thinking" | "error";
}

export function WindowsPowerShellCard({ activity, status = "complete" }: WindowsPowerShellCardProps) {
  const result = activity.result;
  const isThinking = status === "thinking" || !result;
  const isError = status === "error" || (typeof result?.exitCode === "number" && result.exitCode !== 0);
  const output = result?.stdout || result?.stderr || "";
  const visibleOutput = trimOutput(output);

  return (
    <section className={`windows-ps-card${isThinking ? " thinking" : ""}${isError ? " error" : ""}`}>
      <div className="windows-ps-card-orbit" aria-hidden="true" />
      <div className="windows-ps-card-header">
        <div className="windows-ps-card-icon" aria-hidden="true">
          {isThinking ? <Loader2 size={16} /> : isError ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
        </div>
        <div>
          <strong>{activity.title}</strong>
          <span>{activity.description}</span>
        </div>
      </div>

      <div className="windows-ps-card-command">
        <Terminal size={14} />
        <code>{activity.command}</code>
        <CopyButton value={activity.command} label="Copy command" compact />
      </div>

      {isThinking ? (
        <div className="windows-ps-card-shimmer">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <div className="windows-ps-card-footer">
          <span>{activity.group}</span>
          <span>Exit {result?.exitCode ?? "unknown"}</span>
        </div>
      )}

      {!isThinking && visibleOutput ? (
        <div className="windows-ps-card-output-wrap">
          <CopyButton value={visibleOutput} label="Copy output" />
          <pre className="windows-ps-card-output">{visibleOutput}</pre>
        </div>
      ) : null}
    </section>
  );
}

function trimOutput(output: string): string {
  const clean = output.trim();
  return clean.length > 900 ? `${clean.slice(0, 900)}\n\nOutput was shortened for chat.` : clean;
}
