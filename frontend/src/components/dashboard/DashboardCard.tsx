import { ReactNode } from "react";

interface DashboardCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Base card shell used by every dashboard widget. Keep visual
 * styling (border, radius, padding, shadow) centralized here so a
 * future design pass touches one file instead of every widget.
 */
export function DashboardCard({
  title,
  action,
  children,
  className = "",
}: DashboardCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
