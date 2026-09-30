import { ReactNode } from "react";

interface DashboardCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  action,
  children,
  className = "",
}: DashboardCardProps) {
  const hasHeader = Boolean(title || action);

  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:border-slate-300 hover:shadow-md ${className}`}
    >
      {hasHeader ? (
        <header className="mb-4 flex min-w-0 items-center justify-between gap-4">
          {title ? (
            <h3 className="min-w-0 truncate text-sm font-semibold text-slate-700">
              {title}
            </h3>
          ) : (
            <span aria-hidden="true" />
          )}

          {action ? (
            <div className="shrink-0">
              {action}
            </div>
          ) : null}
        </header>
      ) : null}

      <div className="min-w-0">
        {children}
      </div>
    </section>
  );
}
