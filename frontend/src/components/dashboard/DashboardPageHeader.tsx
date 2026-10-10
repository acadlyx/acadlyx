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
  eyebrow: string;
  title: string;
  description?: string;
  breadcrumbs?: DashboardPageBreadcrumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
      {breadcrumbs.length ? (
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true" className="text-slate-300">/</span> : null}
              {crumb.href && index < breadcrumbs.length - 1 ? (
                <Link href={crumb.href} className="rounded hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">{crumb.label}</Link>
              ) : (
                <span aria-current={index === breadcrumbs.length - 1 ? "page" : undefined} className={index === breadcrumbs.length - 1 ? "text-slate-700" : undefined}>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
