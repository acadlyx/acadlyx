"use client";

import Link from "next/link";
import type { WorkspaceBreadcrumb } from "@/lib/workspaceContext";

export function WorkspaceContextHeader({
  breadcrumbs,
  title,
  description,
}: {
  breadcrumbs: WorkspaceBreadcrumb[];
  title?: string;
  description?: string;
}) {
  if (!breadcrumbs.length && !title) return null;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-2">
        {breadcrumbs.length ? (
          <nav aria-label="Current institutional context" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
            {breadcrumbs.map((item, index) => (
              <span key={item.id + item.type} className="inline-flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden="true" className="text-slate-300">›</span> : null}
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-slate-900">{item.label}</span>
                ) : (
                  <Link href={item.href} className="hover:text-blue-700">{item.label}</Link>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        {title ? <h2 className="acadlyx-context-title">{title}</h2> : null}
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
    </section>
  );
}
