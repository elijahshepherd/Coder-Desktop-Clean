import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { TodoProgress, TodoProgressItem } from "../../shared/types";

interface TodoProgressCardProps {
  progress: TodoProgress;
}

export function TodoProgressCard({ progress }: TodoProgressCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const completedCount = progress.items.filter((item) => item.status === "done").length;
  const activeItem = useMemo(
    () => progress.items.find((item) => item.status === "active") ?? progress.items.find((item) => item.status !== "done") ?? progress.items[0],
    [progress.items]
  );

  return (
    <section className={`todo-progress-card${isExpanded ? " expanded" : ""}`}>
      <button className="todo-progress-summary" type="button" aria-expanded={isExpanded} onClick={() => setIsExpanded((current) => !current)}>
        {activeItem ? <TodoStatusIcon item={activeItem} /> : null}
        <span>{activeItem?.title ?? progress.title}</span>
        <strong>
          {completedCount}/{progress.items.length}
        </strong>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {isExpanded ? (
        <div className="todo-progress-list">
          {progress.items.map((item) => (
            <div className={`todo-progress-item ${item.status}`} key={item.id}>
              <TodoStatusIcon item={item} />
              <span>{item.title}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TodoStatusIcon({ item }: { item: TodoProgressItem }) {
  if (item.status === "done") {
    return (
      <span className="todo-status done" aria-label="Done">
        <Check size={13} />
      </span>
    );
  }

  return <span className={`todo-status ${item.status}`} aria-label={item.status === "active" ? "Working" : "Not started"} />;
}
