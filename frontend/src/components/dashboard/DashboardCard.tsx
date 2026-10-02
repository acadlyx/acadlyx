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
  return (
    <section className={`acadlyx-card acadlyx-section-card ${className}`}>
      {title || action ? (
        <header className="acadlyx-card-header">
          {title ? <h3>{title}</h3> : <span aria-hidden="true" />}
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className="acadlyx-card-content">{children}</div>
    </section>
  );
}
