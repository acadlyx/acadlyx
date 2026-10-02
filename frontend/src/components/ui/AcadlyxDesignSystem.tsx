import type { ReactNode } from "react";

export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`acadlyx-page-container ${className}`}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumb,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="acadlyx-page-header">
      <div className="min-w-0">
        {breadcrumb ? <div className="acadlyx-breadcrumb">{breadcrumb}</div> : null}
        {eyebrow ? <p className="acadlyx-eyebrow">{eyebrow}</p> : null}
        <h1 className="acadlyx-page-title">{title}</h1>
        {description ? <p className="acadlyx-page-description">{description}</p> : null}
      </div>
      {actions ? <div className="acadlyx-page-actions">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="acadlyx-empty-state">
      <div className="acadlyx-empty-icon" aria-hidden="true">—</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="acadlyx-empty-action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="acadlyx-loading-state" role="status" aria-live="polite">
      <span className="acadlyx-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="acadlyx-error-state" role="alert">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Button({
  variant = "primary",
  loading = false,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`acadlyx-button acadlyx-button-${variant} ${className}`}
    >
      {loading ? <span className="acadlyx-button-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Card({
  children,
  title,
  action,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`acadlyx-card acadlyx-section-card ${className}`}>
      {title || action ? (
        <header className="acadlyx-card-header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      <div className="acadlyx-card-content">{children}</div>
    </section>
  );
}
