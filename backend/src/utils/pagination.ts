import { Request } from "express";

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Reads page/pageSize off req.query (already string-validated by
 * validateQuery upstream) and turns them into safe, bounded numbers
 * plus the skip/take Prisma needs.
 */
export function parsePagination(req: Request): PaginationParams {
  const rawPage = parseInt(String(req.query.page ?? ""), 10);
  const rawPageSize = parseInt(String(req.query.pageSize ?? ""), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(rawPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginationMeta(
  total: number,
  pagination: PaginationParams
): PaginationMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}
