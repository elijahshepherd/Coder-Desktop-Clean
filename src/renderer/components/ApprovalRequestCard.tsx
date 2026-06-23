import type { ApprovalRequest } from "../../shared/types";

interface ApprovalRequestCardProps {
  request: ApprovalRequest;
  onResolve: (approved: boolean) => void;
}

export function ApprovalRequestCard({ request, onResolve }: ApprovalRequestCardProps) {
  const isPending = request.status === "pending";

  return (
    <section className={`approval-card approval-card-${request.status}`}>
      <div className="approval-card-copy">
        <strong>{request.title}</strong>
        <p>{request.description}</p>
      </div>
      <div className="approval-card-actions">
        {isPending ? (
          <>
            <button className="secondary-button" type="button" onClick={() => onResolve(false)}>
              {request.denyLabel}
            </button>
            <button className="primary-button" type="button" onClick={() => onResolve(true)}>
              {request.approveLabel}
            </button>
          </>
        ) : (
          <span>{request.status === "approved" ? "Approved" : "Denied"}</span>
        )}
      </div>
    </section>
  );
}
