/**
 * Shared response shapes for the typed API clients. Kept in one place so
 * every client agrees on the envelope the backend actually returns
 * ({ success, data, meta }).
 */

export interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PagedEnvelope<T> {
  success: boolean;
  data: T[];
  meta: PageMeta;
  [key: string]: unknown;
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined>
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== false) {
      qs.set(key, String(value));
    }
  }
  const serialized = qs.toString();
  return serialized ? `?${serialized}` : "";
}
