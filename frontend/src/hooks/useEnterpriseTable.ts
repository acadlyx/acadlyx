"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface EnterpriseTableState {
  page: number;
  pageSize: number;
  query: string;
  sort: string;
  direction: "asc" | "desc";
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

export function useEnterpriseTable(defaultPageSize = 25) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<EnterpriseTableState>(() => {
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const requestedSize = Number(searchParams.get("pageSize") || defaultPageSize);
    const pageSize = PAGE_SIZES.includes(requestedSize as (typeof PAGE_SIZES)[number]) ? requestedSize : defaultPageSize;
    const direction = searchParams.get("direction") === "desc" ? "desc" : "asc";
    return {
      page,
      pageSize,
      query: searchParams.get("q") || "",
      sort: searchParams.get("sort") || "",
      direction,
    };
  }, [defaultPageSize, searchParams]);

  const update = useCallback((patch: Partial<EnterpriseTableState>) => {
    const params = new URLSearchParams(searchParams.toString());
    const next = { ...state, ...patch };
    if (next.page <= 1) params.delete("page"); else params.set("page", String(next.page));
    if (next.pageSize === defaultPageSize) params.delete("pageSize"); else params.set("pageSize", String(next.pageSize));
    if (next.query) params.set("q", next.query); else params.delete("q");
    if (next.sort) params.set("sort", next.sort); else params.delete("sort");
    if (next.sort) params.set("direction", next.direction); else params.delete("direction");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }, [defaultPageSize, pathname, router, searchParams, state]);

  const setPage = useCallback((page: number) => update({ page: Math.max(1, page) }), [update]);
  const setPageSize = useCallback((pageSize: number) => update({ page: 1, pageSize }), [update]);
  const setQuery = useCallback((query: string) => update({ page: 1, query }), [update]);
  const setSort = useCallback((sort: string) => update({ page: 1, sort, direction: state.sort === sort && state.direction === "asc" ? "desc" : "asc" }), [state.direction, state.sort, update]);

  return { ...state, pageSizes: PAGE_SIZES, setPage, setPageSize, setQuery, setSort };
}
