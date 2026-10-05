import { authedFetch } from "./auth";
import { buildQuery, Envelope } from "./httpShared";

export interface DirectoryOption {
  id: string;
  label: string;
  hint: string | null;
}

export interface LibraryStudentSearchFilters {
  search?: string;
  department?: string;
  program?: string;
  session?: string;
  semester?: string;
  section?: string;
}

export async function searchStudents(
  search: string
): Promise<DirectoryOption[]> {
  const res = await authedFetch<Envelope<DirectoryOption[]>>(
    `/directory/students${buildQuery({ search })}`
  );
  return res.data;
}

export async function searchLibraryStudents(
  filters: LibraryStudentSearchFilters
): Promise<DirectoryOption[]> {
  const res = await authedFetch<Envelope<DirectoryOption[]>>(
    `/directory/library-students${buildQuery(filters)}`
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
