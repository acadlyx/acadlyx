type Tone = "success" | "warning" | "danger" | "info";

interface ProgressCardProps {
  label: string;
  value: number; // 0-100
  tone?: Tone;
  caption?: string;
}

const BAR_TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
};

function toneForValue(value: number): Tone {
  if (value >= 80) return "success";
  if (value >= 60) return "info";
  if (value >= 40) return "warning";
  return "danger";
}

/** A labeled metric with a horizontal progress bar (attendance, marks, etc.). */
export function ProgressCard({ label, value, tone, caption }: ProgressCardProps) {
  const resolvedTone = tone ?? toneForValue(value);
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className="text-sm font-semibold text-slate-900">{clamped}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${BAR_TONE_CLASSES[resolvedTone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {caption && <p className="mt-1 text-xs text-slate-400">{caption}</p>}
    </div>
  );
}
