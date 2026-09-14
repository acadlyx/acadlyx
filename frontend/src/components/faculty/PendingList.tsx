import { PendingCounts } from "@/types/faculty";

interface PendingListProps {
  pending: PendingCounts;
}

/** Current faculty work requiring attention. */
export function PendingList({ pending }: PendingListProps) {
  const rows = [
    { label: "attendance session", count: pending.attendanceSessions },
    { label: "assignment to review", count: pending.assignmentsToReview },
  ].filter((r) => r.count > 0);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Nothing pending — you&apos;re all caught up.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{r.count}</span>{" "}
          {r.label}
          {r.count !== 1 ? "s" : ""}
        </li>
      ))}
    </ul>
  );
}
