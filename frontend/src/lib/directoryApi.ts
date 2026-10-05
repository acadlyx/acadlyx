import { authedFetch } from "./auth";
import { buildQuery, Envelope } from "./httpShared";

/**
 * Typeahead lookups backing the searchable selectors.
 * The backend scopes every result to what the caller may actually see,
 * so these can be called from any screen without extra guarding.
 */

export interface DirectoryOption {
  id: string;
  label: string;
  hint: string | null;
}

export async function searchStudents(
  search: string
): Promise<DirectoryOption[]> {
  const res = await authedFetch<Envelope<DirectoryOption[]>>(
    `/directory/students${buildQuery({ search })}`
  );
  return res.data;
}

export async function searchUsers(
  search: string,
  roles?: string[]
): Promise<DirectoryOption[]> {
  const res = await authedFetch<Envelope<DirectoryOption[]>>(
    `/directory/users${buildQuery({
      search,
      roles: roles && roles.length ? roles.join(",") : undefined,
    })}`
  );
  return res.data;
}

export async function searchCourseOfferings(
  search: string
): Promise<DirectoryOption[]> {
  const res = await authedFetch<Envelope<DirectoryOption[]>>(
    `/directory/course-offerings${buildQuery({ search })}`
  );
  return res.data;
}
