import { AssignmentItem } from "@/types/dashboard";
import { assignmentStatusTone, StatusBadge } from "./StatusBadge";

interface AssignmentListProps {
  assignments: AssignmentItem[];
}

export function AssignmentList({ assignments }: AssignmentListProps) {
  if (assignments.length === 0) {
    return <p className="text-sm text-slate-400">No assignments due.</p>;
  }

  return (
    <ul className="space-y-3">
      {assignments.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-800">
              {a.courseCode} — {a.title}
            </p>
            <p className="text-xs text-slate-400">{a.dueLabel}</p>
          </div>
          <StatusBadge tone={assignmentStatusTone(a.status)}>
            {a.status}
          </StatusBadge>
        </li>
      ))}
    </ul>
  );
}
