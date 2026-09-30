type Tone =
  | "success"
  | "warning"
  | "danger"
  | "info";

interface ProgressCardProps {
  label: string;
  value: number;
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

export function ProgressCard({
  label,
  value,
  tone,
  caption,
}: ProgressCardProps) {
  const numericValue = Number.isFinite(value)
    ? value
    : 0;

  const clamped = Math.max(
    0,
    Math.min(100, numericValue),
  );

  const resolvedTone =
    tone ?? toneForValue(clamped);

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-slate-600">
          {label}
        </span>

        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
          {Math.round(clamped)}%
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${BAR_TONE_CLASSES[resolvedTone]}`}
          style={{
            width: `${clamped}%`,
          }}
        />
      </div>

      {caption ? (
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
