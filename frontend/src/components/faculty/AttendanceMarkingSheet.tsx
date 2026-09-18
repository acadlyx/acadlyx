"use client";

import { AttendanceStatus, RosterEntry } from "@/types/faculty";

interface AttendanceMarkingSheetProps {
  roster: RosterEntry[];
  statuses: Record<string, AttendanceStatus>;
  onSetStatus: (studentId: string, status: AttendanceStatus) => void;
  onPresentAll: () => void;
  onAbsentAll: () => void;
}

const STATUS_OPTIONS: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT"];

function statusLabel(status: AttendanceStatus): string {
  if (status === "PRESENT") return "Present";
  if (status === "LATE") return "Late";
  return "Absent";
}

export function AttendanceMarkingSheet({
  roster,
  statuses,
  onSetStatus,
  onPresentAll,
  onAbsentAll,
}: AttendanceMarkingSheetProps) {
  if (roster.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No active students are enrolled in this course offering.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {roster.length} students
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPresentAll}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Present All
          </button>
          <button
            type="button"
            onClick={onAbsentAll}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Absent All
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="hidden grid-cols-[1fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 sm:grid">
          <span>Student</span>
          <span>Status</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {roster.map((student) => {
            const status = statuses[student.studentId];

            return (
              <li
                key={student.studentId}
                className="flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {student.rollNumber || "No roll number"} · {student.studentId}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((option) => {
                    const active = status === option;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onSetStatus(student.studentId, option)}
                        aria-pressed={active}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "border-slate-800 bg-slate-800 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {statusLabel(option)}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

