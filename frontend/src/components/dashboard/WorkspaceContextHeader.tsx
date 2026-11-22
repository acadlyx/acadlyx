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
    <section className="mb-6 border-b border-slate-200 pb-4">
      <div className="flex flex-col gap-2">
        {breadcrumbs.length ? (
          <nav aria-label="Current institutional context" className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
            {breadcrumbs.map((item, index) => (
              <span key={item.id + item.type} className="inline-flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden="true" className="text-slate-400">/</span> : null}
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-slate-800" aria-current="location">{item.label}</span>
                ) : (
                  <Link href={item.href} className="hover:text-emerald-800 hover:underline hover:underline-offset-2">{item.label}</Link>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        {title ? <h2 className="acadlyx-context-title">{title}</h2> : null}
        {description ? <p className="max-w-[68ch] text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
    </section>
  );
}
