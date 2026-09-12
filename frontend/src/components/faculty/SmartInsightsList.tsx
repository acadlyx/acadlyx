import { SmartInsights } from "@/types/faculty";

interface SmartInsightsListProps {
  insights: SmartInsights;
}

/**
 * "6 students below 75% attendance" / "4 haven't submitted
 * Assignment #3" style lines. The attendance line is a live
 * computation over real records; the assignment line is demo data
 * (see docs/PHASE-4.md) presented identically on purpose — the UI
 * doesn't need to editorialize which is which.
 */
export function SmartInsightsList({ insights }: SmartInsightsListProps) {
  const lines: string[] = [];

  if (insights.studentsBelowAttendanceThreshold.count > 0) {
    lines.push(
      `${insights.studentsBelowAttendanceThreshold.count} student${
        insights.studentsBelowAttendanceThreshold.count !== 1 ? "s" : ""
      } below 75% attendance`
    );
  }

  for (const gap of insights.assignmentSubmissionGaps) {
    lines.push(
      `${gap.missingCount} student${gap.missingCount !== 1 ? "s" : ""} haven't submitted ${gap.assignmentTitle}`
    );
  }

  if (lines.length === 0) {
    return <p className="text-sm text-slate-400">No issues flagged right now.</p>;
  }

  return (
    <ul className="space-y-2">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          {line}
        </li>
      ))}
    </ul>
  );
}
