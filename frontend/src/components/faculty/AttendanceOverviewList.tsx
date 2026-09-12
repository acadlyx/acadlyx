import Link from "next/link";
import { AttendanceOverviewItem } from "@/types/faculty";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

interface AttendanceOverviewListProps {
  items: AttendanceOverviewItem[];
}

/** Per-section "CSE-A 42/48" snapshot, each linking straight into that section's marking sheet. */
export function AttendanceOverviewList({ items }: AttendanceOverviewListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">No assigned sections yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.courseOfferingId} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-800">
              {item.courseCode} — Section {item.sectionName}
            </p>
            <p className="text-xs text-slate-400">
              {item.presentCount}/{item.rosterSize} present today
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!item.isStarted && <StatusBadge tone="neutral">Not started</StatusBadge>}
            {item.isStarted && !item.isSubmitted && (
              <StatusBadge tone="warning">In progress</StatusBadge>
            )}
            {item.isSubmitted && <StatusBadge tone="success">Submitted</StatusBadge>}
            <Link
              href={`/faculty/marks/${item.courseOfferingId}`}
              className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
            >
              Marks
            </Link>
            <Link
              href={`/faculty/attendance/${item.courseOfferingId}`}
              className="text-xs font-medium text-acadlyx-primary underline-offset-2 hover:underline"
            >
              {item.isStarted ? "Open" : "Take attendance"}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
