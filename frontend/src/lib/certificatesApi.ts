import { apiUrl } from "./api";
import { authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope, PageMeta } from "./httpShared";

export const CERTIFICATE_TYPES = [
  "BONAFIDE",
  "CHARACTER",
  "TRANSFER",
  "MARKSHEET",
  "COURSE_COMPLETION",
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_STATUSES = ["REQUESTED", "ISSUED", "REJECTED"] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export interface Certificate {
  id: string;
  certificateType: CertificateType;
  certificateNumber: string | null;
  purpose: string | null;
  status: CertificateStatus;
  issuedAt: string | null;
  remarks: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
  student: { id: string; firstName: string; lastName: string; email: string };
}

export async function listCertificates(params: {
  page?: number;
  status?: CertificateStatus;
  certificateType?: CertificateType;
  studentId?: string;
  search?: string;
} = {}): Promise<{
  items: Certificate[];
  summary: Record<string, number>;
  meta: PageMeta;
}> {
  const res = await authedFetch<
    PagedEnvelope<Certificate> & { summary: Record<string, number> }
  >(`/certificates${buildQuery(params as Record<string, string | number | undefined>)}`);
  return { items: res.data, summary: res.summary ?? {}, meta: res.meta };
}

export async function listMyCertificates(): Promise<Certificate[]> {
  const res = await authedFetch<Envelope<Certificate[]>>("/certificates/mine");
  return res.data;
}

export async function requestCertificate(input: {
  certificateType: CertificateType;
  purpose: string;
  studentId?: string;
}): Promise<Certificate> {
  const res = await authedFetch<Envelope<Certificate>>("/certificates", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function issueCertificate(
  id: string,
  remarks?: string
): Promise<Certificate> {
  const res = await authedFetch<Envelope<Certificate>>(
    `/certificates/${id}/issue`,
    { method: "POST", body: JSON.stringify({ remarks }) }
  );
  return res.data;
}

export async function rejectCertificate(
  id: string,
  remarks: string
): Promise<Certificate> {
  const res = await authedFetch<Envelope<Certificate>>(
    `/certificates/${id}/reject`,
    { method: "POST", body: JSON.stringify({ remarks }) }
  );
  return res.data;
}

export async function getCertificate(id: string): Promise<Certificate> {
  const res = await authedFetch<Envelope<Certificate>>(`/certificates/${id}`);
  return res.data;
}

export interface VerificationResult {
  valid: boolean;
  certificateNumber?: string;
  certificateType?: CertificateType;
  issuedAt?: string | null;
  studentName?: string;
  institution?: string;
}

/** Verification is public: no token is attached. */
export async function verifyCertificate(
  certificateNumber: string
): Promise<VerificationResult> {
  const res = await fetch(
    apiUrl(`/certificates/verify/${encodeURIComponent(certificateNumber)}`)
  );
  if (!res.ok) {
    throw new Error(`Verification failed: ${res.status}`);
  }
  const body = (await res.json()) as Envelope<VerificationResult>;
  return body.data;
}
