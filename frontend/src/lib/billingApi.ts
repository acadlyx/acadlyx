import { authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope } from "./httpShared";

/** Typed client for the fee billing lifecycle. */

export interface Invoice {
  id: string;
  studentId: string;
  studentName?: string;
  invoiceNumber: string | null;
  title: string;
  amount: number;
  grossAmount: number | null;
  discountAmount: number;
  lateFeeAmount: number;
  paidAmount: number;
  refundedAmount: number;
  outstanding: number;
  dueDate: string | null;
  status: string;
  installmentNumber: number;
  currency: string;
}

export interface InvoiceSummary {
  billed: number;
  collected: number;
  outstanding: number;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  receiptNumber: string | null;
  paidAt: string;
  refundedAmount: number;
}

export async function listInvoices(params: {
  page?: number;
  studentId?: string;
  status?: string;
  overdueOnly?: boolean;
  search?: string;
}): Promise<{ items: Invoice[]; total: number; summary: InvoiceSummary }> {
  const res = await authedFetch<
    PagedEnvelope<Invoice> & { summary: InvoiceSummary }
  >(`/billing/invoices${buildQuery(params)}`);
  return { items: res.data, total: res.meta.total, summary: res.summary };
}

export async function getInvoice(
  id: string
): Promise<Invoice & { payments: Payment[]; computedStatus: string }> {
  const res = await authedFetch<
    Envelope<Invoice & { payments: Payment[]; computedStatus: string }>
  >(`/billing/invoices/${id}`);
  return res.data;
}

export async function generateInvoices(body: {
  feeStructureId: string;
  firstDueDate: string;
  studentIds?: string[];
  installmentGapDays?: number;
}) {
  const res = await authedFetch<
    Envelope<{ students: number; created: number; skipped: number }>
  >("/billing/invoices/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function cancelInvoice(id: string, reason: string) {
  const res = await authedFetch<Envelope<Invoice>>(
    `/billing/invoices/${id}/cancel`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
  return res.data;
}

export async function recordOfflinePayment(body: {
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
}) {
  const res = await authedFetch<
    Envelope<{ paymentId: string; receiptNumber: string; invoiceStatus: string }>
  >("/billing/payments/offline", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function startCheckout(invoiceId: string) {
  const res = await authedFetch<
    Envelope<{
      provider: string;
      orderId: string;
      amount: number;
      currency: string;
      publicKey: string | null;
    }>
  >(`/billing/invoices/${invoiceId}/checkout`, { method: "POST" });
  return res.data;
}

export async function confirmPayment(body: {
  invoiceId: string;
  orderId: string;
  paymentId: string;
  signature: string;
  amount: number;
}) {
  const res = await authedFetch<Envelope<{ receiptNumber: string }>>(
    "/billing/payments/confirm",
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export interface Receipt {
  receiptNumber: string | null;
  issuedAt: string;
  amount: number;
  method: string;
  reference: string | null;
  institution: { name: string; code: string };
  student: { name: string; email: string };
  invoice: {
    invoiceNumber: string | null;
    title: string;
    amount: number;
    lateFeeAmount: number;
    paidAmount: number;
    outstanding: number;
  };
}

export async function getReceipt(paymentId: string): Promise<Receipt> {
  const res = await authedFetch<Envelope<Receipt>>(
    `/billing/payments/${paymentId}/receipt`
  );
  return res.data;
}

export async function listConcessions(params: {
  page?: number;
  studentId?: string;
  status?: string;
}) {
  const res = await authedFetch<PagedEnvelope<Record<string, unknown>>>(
    `/billing/concessions${buildQuery(params)}`
  );
  return { items: res.data, total: res.meta.total };
}

export async function createConcession(body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    "/billing/concessions",
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function decideConcession(
  id: string,
  status: "APPROVED" | "REJECTED"
) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/billing/concessions/${id}`,
    { method: "PATCH", body: JSON.stringify({ status }) }
  );
  return res.data;
}

export async function listLateFeeRules() {
  const res = await authedFetch<Envelope<Array<Record<string, unknown>>>>(
    "/billing/late-fee-rules"
  );
  return res.data;
}

export async function createLateFeeRule(body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    "/billing/late-fee-rules",
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function applyLateFees() {
  const res = await authedFetch<
    Envelope<{ invoicesUpdated: number; totalCharged: number }>
  >("/billing/late-fees/apply", { method: "POST" });
  return res.data;
}

export async function listRefunds(params: { status?: string; page?: number }) {
  const res = await authedFetch<PagedEnvelope<Record<string, unknown>>>(
    `/billing/refunds${buildQuery(params)}`
  );
  return { items: res.data, total: res.meta.total };
}

export async function requestRefund(body: {
  feePaymentId: string;
  amount: number;
  reason: string;
}) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    "/billing/refunds",
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function decideRefund(id: string, body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/billing/refunds/${id}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function listReconciliations(params: { page?: number }) {
  const res = await authedFetch<PagedEnvelope<Record<string, unknown>>>(
    `/billing/reconciliations${buildQuery(params)}`
  );
  return { items: res.data, total: res.meta.total };
}

export async function createReconciliation(body: Record<string, unknown>) {
  const res = await authedFetch<
    Envelope<{ id: string; matched: number; unmatched: number }>
  >("/billing/reconciliations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export interface StudentFeeSummary {
  studentId: string;
  summary: {
    billed: number;
    paid: number;
    outstanding: number;
    overdueCount: number;
  };
  invoices: Invoice[];
  payments: Array<Payment & { invoiceTitle: string }>;
}

export async function getStudentFees(
  studentId: string
): Promise<StudentFeeSummary> {
  const res = await authedFetch<Envelope<StudentFeeSummary>>(
    `/billing/students/${studentId}`
  );
  return res.data;
}
