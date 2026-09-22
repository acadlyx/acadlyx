import { authedFetch } from "./auth";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface PaginatedEnvelope<T> {
  success: boolean;
  data: T[];
  summary?: { byStatus: Record<string, number>; departments: number };
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "VISITING"] as const;
export const EMPLOYEE_STATUSES = [
  "ACTIVE",
  "ON_LEAVE",
  "RESIGNED",
  "TERMINATED",
  "RETIRED",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export interface Employee {
  id: string;
  employeeCode: string;
  designation: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  joiningDate: string;
  qualification: string | null;
  department: { id: string; name: string; code: string } | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    roles: string[];
  };
}

export interface EligibleUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

export interface EmployeeListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
}

export interface EmployeeListResult {
  items: Employee[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  summary: { byStatus: Record<string, number>; departments: number };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function listEmployees(params: EmployeeListParams = {}): Promise<EmployeeListResult> {
  const query = buildQuery({
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    departmentId: params.departmentId,
    status: params.status,
    employmentType: params.employmentType,
  });
  const res = await authedFetch<PaginatedEnvelope<Employee>>(`/hr/employees${query}`);
  return {
    items: res.data,
    total: res.meta.total,
    totalPages: res.meta.totalPages,
    page: res.meta.page,
    pageSize: res.meta.pageSize,
    summary: res.summary ?? { byStatus: {}, departments: 0 },
  };
}

export async function getEmployee(id: string): Promise<Employee> {
  const res = await authedFetch<ApiEnvelope<Employee>>(`/hr/employees/${id}`);
  return res.data;
}

export async function listEligibleUsers(): Promise<EligibleUser[]> {
  const res = await authedFetch<ApiEnvelope<EligibleUser[]>>("/hr/eligible-users");
  return res.data;
}

export interface CreateEmployeeInput {
  userId: string;
  employeeCode: string;
  departmentId?: string;
  designation: string;
  employmentType: EmploymentType;
  joiningDate: string;
  qualification?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const res = await authedFetch<ApiEnvelope<Employee>>("/hr/employees", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateEmployeeStatus(
  id: string,
  status: EmployeeStatus
): Promise<Employee> {
  const res = await authedFetch<ApiEnvelope<Employee>>(`/hr/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return res.data;
}

export async function listDepartmentOptions(): Promise<DepartmentOption[]> {
  const res = await authedFetch<PaginatedEnvelope<DepartmentOption>>(
    "/departments?pageSize=100"
  );
  return res.data;
}
