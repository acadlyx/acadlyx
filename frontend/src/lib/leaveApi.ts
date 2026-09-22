import { authedFetch } from "./auth";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface PaginatedEnvelope<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  applicableRoles: string[];
  isActive: boolean;
}

export interface LeaveBalance {
  leaveTypeId: string;
  name: string;
  code: string;
  annualQuota: number;
  used: number;
  pending: number;
  remaining: number | null;
}

export interface LeaveRequest {
  id: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  decisionNote: string | null;
  createdAt: string;
  leaveType: { id: string; name: string; code: string };
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    roles: string[];
  };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function listLeaveTypes(): Promise<LeaveType[]> {
  const res = await authedFetch<ApiEnvelope<LeaveType[]>>("/leave/types");
  return res.data;
}

export async function getLeaveBalances(): Promise<LeaveBalance[]> {
  const res = await authedFetch<ApiEnvelope<LeaveBalance[]>>("/leave/balances");
  return res.data;
}

export async function applyLeave(input: {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason: string;
}): Promise<LeaveRequest> {
  const res = await authedFetch<ApiEnvelope<LeaveRequest>>("/leave/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export interface LeaveListParams {
  page?: number;
  pageSize?: number;
  status?: LeaveStatus;
  leaveTypeId?: string;
}

export interface LeaveListResult {
  items: LeaveRequest[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

async function fetchPaged(path: string, params: LeaveListParams): Promise<LeaveListResult> {
  const query = buildQuery({
    page: params.page,
    pageSize: params.pageSize,
    status: params.status,
    leaveTypeId: params.leaveTypeId,
  });
  const res = await authedFetch<PaginatedEnvelope<LeaveRequest>>(`${path}${query}`);
  return {
    items: res.data,
    total: res.meta.total,
    totalPages: res.meta.totalPages,
    page: res.meta.page,
    pageSize: res.meta.pageSize,
  };
}

export function listMyLeaveRequests(params: LeaveListParams = {}) {
  return fetchPaged("/leave/requests/mine", params);
}

export function listLeaveApprovals(params: LeaveListParams = {}) {
  return fetchPaged("/leave/requests/approvals", params);
}

export async function decideLeaveRequest(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note?: string
): Promise<LeaveRequest> {
  const res = await authedFetch<ApiEnvelope<LeaveRequest>>(`/leave/requests/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
  return res.data;
}

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  const res = await authedFetch<ApiEnvelope<LeaveRequest>>(`/leave/requests/${id}/cancel`, {
    method: "POST",
  });
  return res.data;
}
