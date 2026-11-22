import type { ReactNode } from "react";
import Link from "next/link";

export type DashboardPageBreadcrumb = { label: string; href?: string };

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs = [],
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: DashboardPageBreadcrumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="acadlyx-route-header">
      {breadcrumbs.length ? (
        <nav aria-label="Breadcrumb" className="acadlyx-route-breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.label + "-" + index} className="acadlyx-route-breadcrumb">
              {index > 0 ? <span aria-hidden="true" className="acadlyx-route-breadcrumb-separator">/</span> : null}
              {crumb.href && index < breadcrumbs.length - 1 ? (
                <Link href={crumb.href} className="acadlyx-route-breadcrumb-link">{crumb.label}</Link>
              ) : (
                <span aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="acadlyx-route-header-main">
        <div className="min-w-0">
          {eyebrow ? <p className="acadlyx-route-eyebrow">{eyebrow}</p> : null}
          <h1 className="acadlyx-route-title">{title}</h1>
          {description ? <p className="acadlyx-route-description">{description}</p> : null}
        </div>
        {actions ? <div className="acadlyx-route-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
