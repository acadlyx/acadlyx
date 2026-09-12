import { AttendanceStatus, RosterEntry } from "@/types/faculty";

interface AttendanceMarkingSheetProps {
  roster: RosterEntry[];
  statuses: Record<string, AttendanceStatus>;
  onToggle: (studentId: string) => void;
  onPresentAll: () => void;
}

/**
 * The one-click attendance checklist. Presentational + controlled —
 * the parent page owns `statuses` so it can compute unmarked counts,
 * validate, and call the submit API. Checkbox click = individual
 * correction; "Present All" = the bulk action.
 */
export function AttendanceMarkingSheet({
  roster,
  statuses,
  onToggle,
  onPresentAll,
}: AttendanceMarkingSheetProps) {
  if (roster.length === 0) {
    return <p className="text-sm text-slate-400">No students enrolled in this section.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{roster.length} students</p>
        <button
          type="button"
          onClick={onPresentAll}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Present All
        </button>
      </div>

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {roster.map((student) => {
          const status = statuses[student.studentId];
          const isPresent = status === "PRESENT";
          return (
            <li
              key={student.studentId}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={isPresent}
                  onChange={() => onToggle(student.studentId)}
                  className="h-4 w-4 rounded border-slate-300 text-acadlyx-primary focus:ring-acadlyx-primary"
                />
                <span className="text-sm text-slate-800">
                  {student.firstName} {student.lastName}
                </span>
                {student.rollNumber && (
                  <span className="text-xs text-slate-400">{student.rollNumber}</span>
                )}
              </label>
              <span
                className={`text-xs font-medium ${
                  status === undefined
                    ? "text-slate-300"
                    : isPresent
                      ? "text-emerald-600"
                      : "text-red-500"
                }`}
              >
                {status === undefined ? "Unmarked" : isPresent ? "Present" : "Absent"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
