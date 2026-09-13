import { TodayClassSlot } from "@/types/dashboard";

interface ClassScheduleProps {
  classes: TodayClassSlot[];
}

/** Today's database-backed class list. */
export function ClassSchedule({ classes }: ClassScheduleProps) {
  if (classes.length === 0) {
    return <p className="text-sm text-slate-400">No classes scheduled today.</p>;
  }

  return (
    <ul className="space-y-3">
      {classes.map((cls, i) => (
        <li
          key={`${cls.courseCode}-${i}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-sm font-semibold text-slate-900">
              {cls.time}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">
                {cls.courseCode} — {cls.courseName}
              </p>
              <p className="text-xs text-slate-400">{cls.location}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
