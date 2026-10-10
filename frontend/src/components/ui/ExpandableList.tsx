"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function ExpandableList<T>({
  items,
  getKey,
  renderItem,
  initialCount = 3,
  batchSize = 3,
  empty,
  className = "space-y-3",
  label = "records",
}: {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  initialCount?: number;
  batchSize?: number;
  empty?: ReactNode;
  className?: string;
  label?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  useEffect(() => setVisibleCount(initialCount), [items, initialCount]);
  const visible = items.slice(0, visibleCount);
  if (items.length === 0) return empty ?? null;

  return (
    <div className={className}>
      {visible.map((item, index) => <div key={getKey(item, index)}>{renderItem(item, index)}</div>)}
      {items.length > initialCount ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500" aria-live="polite">Showing {visible.length} of {items.length} {label}</p>
          <div className="flex items-center gap-2">
            {visibleCount > initialCount ? (
              <button type="button" onClick={() => setVisibleCount(initialCount)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Show less</button>
            ) : null}
            {visibleCount < items.length ? (
              <button type="button" onClick={() => setVisibleCount((count) => Math.min(items.length, count + batchSize))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Show more</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
