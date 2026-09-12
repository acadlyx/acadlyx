import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/** Page-level section heading (distinct from a card's internal title). */
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
