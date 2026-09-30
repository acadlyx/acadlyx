type Tone =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "info";

interface StatusBadgeProps {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger:
    "bg-red-50 text-red-700 ring-red-600/20",
  neutral:
    "bg-slate-100 text-slate-600 ring-slate-500/20",
  info:
    "bg-blue-50 text-blue-700 ring-blue-600/20",
};

export function StatusBadge({
  tone,
  children,
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      role="status"
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium leading-4 ring-1 ring-inset ${TONE_CLASSES[tone]} ${className}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function riskTone(
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
): Tone {
  switch (risk) {
    case "LOW":
      return "success";

    case "MEDIUM":
      return "warning";

    case "HIGH":
    case "CRITICAL":
      return "danger";
  }
}

export function assignmentStatusTone(
  status: "pending" | "submitted" | "overdue",
): Tone {
  switch (status) {
    case "submitted":
      return "success";

    case "pending":
      return "warning";

    case "overdue":
      return "danger";
  }
}
