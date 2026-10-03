"use client";

import Link from "next/link";
import type { WorkspaceBreadcrumb } from "@/lib/workspaceContext";

export function ContextBreadcrumbs({
  items,
  compact = false,
}: {
  items: WorkspaceBreadcrumb[];
  compact?: boolean;
}) {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Institutional context"
      className={
        compact
          ? "flex items-center gap-1 overflow-x-auto text-xs"
          : "flex items-center gap-1 overflow-x-auto rounded-2xl border border-[#dfd4c4] bg-white px-4 py-3 text-sm shadow-sm"
      }
    >
      {items.map((item, index) => (
        <span
          key={`${item.type}-${item.id}`}
          className="flex shrink-0 items-center gap-1"
        >
          {index > 0 ? (
            <span className="px-1 text-slate-400">/</span>
          ) : null}

          {index === items.length - 1 ? (
            <span className="font-semibold text-slate-900">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="font-medium text-slate-500 transition hover:text-slate-900"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
