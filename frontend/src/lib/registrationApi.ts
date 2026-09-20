import { authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope, PageMeta } from "./httpShared";

export const REGISTRATION_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "DROPPED",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export interface AvailableOffering {
  id: string;
  course: { id: string; code: string; name: string; credits: number };
  semester: { id: string; name: string };
  section: { id: string; name: string; capacity: number | null };
  faculty: { id: string; firstName: string; lastName: string } | null;
  isElective: boolean;
  registrationOpen: boolean;
  capacity: number | null;
  seatsTaken: number;
  seatsLeft: number | null;
  myStatus: RegistrationStatus | null;
}

export interface Registration {
  id: string;
  status: RegistrationStatus;
  remarks: string | null;
  decidedAt: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; email: string };
  courseOffering: {
    id: string;
    capacity: number | null;
    registrationOpen: boolean;
    isElective: boolean;
    course: { id: string; code: string; name: string; credits: number };
    semester: { id: string; name: string };
    section: { id: string; name: string; capacity: number | null };
    faculty: { id: string; firstName: string; lastName: string } | null;
  };
}

export interface EnrollmentContext {
  id: string;
  program: { id: string; name: string };
  academicYear: { id: string; name: string };
  semester: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
  rollNumber: string | null;
}

export async function listAvailableOfferings(params: {
  page?: number;
  semesterId?: string;
  electivesOnly?: boolean;
  search?: string;
} = {}): Promise<{
  items: AvailableOffering[];
  enrollment: EnrollmentContext;
  meta: PageMeta;
}> {
  const res = await authedFetch<
    PagedEnvelope<AvailableOffering> & { enrollment: EnrollmentContext }
  >(
    `/registrations/offerings/available${buildQuery({
      page: params.page,
      semesterId: params.semesterId,
      electivesOnly: params.electivesOnly ? "true" : undefined,
      search: params.search,
    })}`
  );
  return { items: res.data, enrollment: res.enrollment, meta: res.meta };
}

export interface MyRegistrationSummary {
  items: Registration[];
  registeredCredits: number;
  minCredits: number;
  maxCredits: number;
  meetsMinimum: boolean;
}

export async function getMyRegistrations(): Promise<MyRegistrationSummary> {
  const res = await authedFetch<Envelope<MyRegistrationSummary>>(
    "/registrations/mine"
  );
  return res.data;
}

export async function registerForOffering(
  courseOfferingId: string,
  studentId?: string
): Promise<Registration> {
  const res = await authedFetch<Envelope<Registration>>("/registrations", {
    method: "POST",
    body: JSON.stringify({ courseOfferingId, studentId }),
  });
  return res.data;
}

export async function dropRegistration(
  id: string,
  reason?: string
): Promise<Registration> {
  const res = await authedFetch<Envelope<Registration>>(
    `/registrations/${id}/drop`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
  return res.data;
}

export async function decideRegistration(
  id: string,
  decision: "APPROVED" | "REJECTED",
  remarks?: string
): Promise<Registration> {
  const res = await authedFetch<Envelope<Registration>>(
    `/registrations/${id}/decision`,
    { method: "POST", body: JSON.stringify({ decision, remarks }) }
  );
  return res.data;
}

export async function listRegistrations(params: {
  page?: number;
  status?: RegistrationStatus;
  courseOfferingId?: string;
  studentId?: string;
  semesterId?: string;
  search?: string;
} = {}): Promise<{
  items: Registration[];
  summary: Record<string, number>;
  meta: PageMeta;
}> {
  const res = await authedFetch<
    PagedEnvelope<Registration> & { summary: Record<string, number> }
  >(`/registrations${buildQuery(params as Record<string, string | number | undefined>)}`);
  return { items: res.data, summary: res.summary ?? {}, meta: res.meta };
}

export async function updateOfferingCapacity(
  courseOfferingId: string,
  input: {
    capacity?: number | null;
    registrationOpen?: boolean;
    isElective?: boolean;
  }
): Promise<{
  id: string;
  capacity: number | null;
  registrationOpen: boolean;
  isElective: boolean;
}> {
  const res = await authedFetch<
    Envelope<{
      id: string;
      capacity: number | null;
      registrationOpen: boolean;
      isElective: boolean;
    }>
  >(`/registrations/offerings/${courseOfferingId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data;
}
