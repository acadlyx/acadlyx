"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import EntityPicker from "@/components/common/EntityPicker";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { DirectoryOption } from "@/lib/directoryApi";
import {
  Invoice,
  InvoiceSummary,
  Receipt,
  applyLateFees,
  cancelInvoice,
  createConcession,
  decideConcession,
  decideRefund,
  getReceipt,
  getStudentFees,
  listConcessions,
  listInvoices,
  listRefunds,
  recordOfflinePayment,
  requestRefund,
} from "@/lib/billingApi";

/**
 * Fee collection desk.
 *
 * Covers the money-movement half of the fee module: outstanding
 * invoices, counter collection with an immediate receipt, concessions
 * awaiting approval, and refunds. Fee heads and structures stay on the
 * ERP configuration screen.
 */

type Tab = "invoices" | "concessions" | "refunds" | "student";

const money = (value: number) =>
  value.toLocaleString("en-IN", { style: "currency", currency: "INR" });

export default function FeesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("invoices");
  const [roles, setRoles] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [concessions, setConcessions] = useState<Record<string, unknown>[]>([]);
  const [refunds, setRefunds] = useState<Record<string, unknown>[]>([]);
  const [student, setStudent] = useState<DirectoryOption | null>(null);
  const [studentFees, setStudentFees] = useState<Awaited<
    ReturnType<typeof getStudentFees>
  > | null>(null);
  const [collectFor, setCollectFor] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canApprove = roles.some((role) =>
    ["DIRECTOR", "ACCOUNTS"].includes(role)
  );
  const canCollect = roles.some((role) =>
    ["ACCOUNTS"].includes(role)
  );

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await fn();
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const loadInvoices = useCallback(async () => {
    const result = await listInvoices({
      page: 1,
      overdueOnly: overdueOnly || undefined,
      search: search.trim() || undefined,
    });
    setInvoices(result.items);
    setSummary(result.summary);
  }, [overdueOnly, search]);

  useEffect(() => {
    void run(async () => {
      const user = await getCurrentUser();
      setRoles(user?.roles ?? []);
      await loadInvoices();
    });
  }, [run, loadInvoices]);

  useEffect(() => {
    if (tab === "concessions") {
      void run(async () => {
        setConcessions((await listConcessions({ page: 1 })).items);
      });
    }
    if (tab === "refunds") {
      void run(async () => {
        setRefunds((await listRefunds({ page: 1 })).items);
      });
    }
  }, [tab, run]);

  return (
    <DashboardShell
      title="Fees"
      subtitle="Invoices, collection, receipts, concessions and refunds"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {summary && (
          <section className="grid gap-4 sm:grid-cols-3">
            {[
              ["Billed", summary.billed],
              ["Collected", summary.collected],
              ["Outstanding", summary.outstanding],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {money(Number(value))}
                </p>
              </div>
            ))}
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          {(["invoices", "concessions", "refunds", "student"] as Tab[]).map(
            (key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${
                  tab === key
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {key === "student" ? "Student ledger" : key}
              </button>
            )
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        {tab === "invoices" && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Invoice number or student name"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={overdueOnly}
                  onChange={(event) => setOverdueOnly(event.target.checked)}
                />
                Overdue only
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(loadInvoices)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Apply
              </button>
              {canCollect && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await applyLateFees();
                      setNotice(
                        `Late fees applied to ${result.invoicesUpdated} invoice(s), ${money(result.totalCharged)} charged`
                      );
                      await loadInvoices();
                    })
                  }
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
                >
                  Run late fees
                </button>
              )}
            </div>

            {invoices.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices match.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-2">Invoice</th>
                      <th className="pb-2">Student</th>
                      <th className="pb-2">Due</th>
                      <th className="pb-2">Amount</th>
                      <th className="pb-2">Outstanding</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="py-2 font-medium text-slate-900">
                          {invoice.invoiceNumber ?? "—"}
                          <span className="block text-xs text-slate-400">
                            {invoice.title}
                          </span>
                        </td>
                        <td className="py-2 text-slate-600">
                          {invoice.studentName ?? "—"}
                        </td>
                        <td className="py-2 text-slate-600">
                          {invoice.dueDate
                            ? new Date(invoice.dueDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-2 text-slate-600">
                          {money(invoice.amount + invoice.lateFeeAmount)}
                        </td>
                        <td className="py-2 font-semibold text-slate-900">
                          {money(invoice.outstanding)}
                        </td>
                        <td className="py-2">
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {invoice.status}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {canCollect && invoice.outstanding > 0 && (
                            <button
                              type="button"
                              onClick={() => setCollectFor(invoice)}
                              className="text-sm font-semibold text-slate-900"
                            >
                              Collect
                            </button>
                          )}
                          {canApprove &&
                            invoice.paidAmount === 0 &&
                            invoice.status !== "CANCELLED" && (
                              <button
                                type="button"
                                onClick={() =>
                                  run(async () => {
                                    const reason = window.prompt(
                                      "Reason for cancelling this invoice?"
                                    );
                                    if (!reason) return;
                                    await cancelInvoice(invoice.id, reason);
                                    setNotice("Invoice cancelled");
                                    await loadInvoices();
                                  })
                                }
                                className="ml-3 text-sm font-semibold text-red-600"
                              >
                                Cancel
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {collectFor && (
          <CollectPayment
            invoice={collectFor}
            busy={busy}
            onCancel={() => setCollectFor(null)}
            onSubmit={(body) =>
              run(async () => {
                const result = await recordOfflinePayment({
                  invoiceId: collectFor.id,
                  ...body,
                });
                setCollectFor(null);
                setNotice(`Receipt ${result.receiptNumber} issued`);
                setReceipt(await getReceipt(result.paymentId));
                await loadInvoices();
              })
            }
          />
        )}

        {receipt && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Receipt {receipt.receiptNumber}
                </h2>
                <p className="text-sm text-slate-600">
                  {receipt.institution.name} · {receipt.student.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="text-sm font-semibold text-slate-600"
              >
                Dismiss
              </button>
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Paid</dt>
                <dd className="font-semibold">{money(receipt.amount)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Method</dt>
                <dd className="font-semibold">{receipt.method}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Invoice</dt>
                <dd className="font-semibold">
                  {receipt.invoice.invoiceNumber}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Still outstanding</dt>
                <dd className="font-semibold">
                  {money(receipt.invoice.outstanding)}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {tab === "concessions" && (
          <ConcessionPanel
            items={concessions}
            canApprove={canApprove}
            busy={busy}
            onCreate={(body) =>
              run(async () => {
                await createConcession(body);
                setConcessions((await listConcessions({ page: 1 })).items);
                setNotice("Concession submitted for approval");
              })
            }
            onDecide={(id, status) =>
              run(async () => {
                await decideConcession(id, status);
                setConcessions((await listConcessions({ page: 1 })).items);
              })
            }
          />
        )}

        {tab === "refunds" && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Refunds</h2>
            {refunds.length === 0 ? (
              <p className="text-sm text-slate-500">No refund requests.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {refunds.map((refund) => (
                  <li
                    key={String(refund.id)}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {String(refund.studentName)} ·{" "}
                        {money(Number(refund.amount))}
                      </p>
                      <p className="text-xs text-slate-500">
                        {String(refund.reason)} · receipt{" "}
                        {String(refund.receiptNumber ?? "—")} ·{" "}
                        {String(refund.status)}
                      </p>
                    </div>
                    {canApprove && refund.status === "REQUESTED" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await decideRefund(String(refund.id), {
                                status: "PROCESSED",
                              });
                              setRefunds((await listRefunds({ page: 1 })).items);
                              setNotice("Refund processed");
                            })
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Process
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await decideRefund(String(refund.id), {
                                status: "REJECTED",
                              });
                              setRefunds((await listRefunds({ page: 1 })).items);
                            })
                          }
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "student" && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <EntityPicker
                  kind="student"
                  label="Student"
                  value={student}
                  onChange={(option) => {
                    setStudent(option);
                    setStudentFees(null);
                    if (option) {
                      void run(async () => {
                        setStudentFees(await getStudentFees(option.id));
                      });
                    }
                  }}
                />
              </div>
            </div>

            {studentFees && (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    ["Billed", studentFees.summary.billed],
                    ["Paid", studentFees.summary.paid],
                    ["Outstanding", studentFees.summary.outstanding],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl bg-slate-50 p-4"
                    >
                      <p className="text-xs uppercase text-slate-500">{label}</p>
                      <p className="mt-1 text-lg font-bold">
                        {money(Number(value))}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Overdue</p>
                    <p className="mt-1 text-lg font-bold">
                      {studentFees.summary.overdueCount}
                    </p>
                  </div>
                </div>

                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Payments
                </h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {studentFees.payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span>
                        {payment.invoiceTitle} · {payment.method}
                        <span className="ml-2 text-xs text-slate-400">
                          {payment.receiptNumber}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 font-semibold">
                        {money(payment.amount)}
                        {canCollect && (
                          <button
                            type="button"
                            onClick={() =>
                              run(async () => {
                                const amount = window.prompt(
                                  "Refund amount",
                                  String(payment.amount)
                                );
                                const reason = amount
                                  ? window.prompt("Reason for the refund")
                                  : null;
                                if (!amount || !reason) return;
                                await requestRefund({
                                  feePaymentId: payment.id,
                                  amount: Number(amount),
                                  reason,
                                });
                                setNotice("Refund requested for approval");
                              })
                            }
                            className="text-xs font-semibold text-slate-500"
                          >
                            Refund
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function CollectPayment({
  invoice,
  busy,
  onCancel,
  onSubmit,
}: {
  invoice: Invoice;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: {
    amount: number;
    method: string;
    reference?: string;
  }) => void;
}) {
  const [amount, setAmount] = useState(invoice.outstanding.toFixed(2));
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      amount: Number(amount),
      method,
      reference: reference.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-3xl border border-indigo-200 bg-indigo-50 p-6"
    >
      <div className="w-full">
        <h2 className="text-lg font-bold text-slate-900">
          Collect against {invoice.invoiceNumber ?? invoice.title}
        </h2>
        <p className="text-sm text-slate-600">
          Outstanding {money(invoice.outstanding)}
        </p>
      </div>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Amount</span>
        <input
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-36 rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Method</span>
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        >
          {["CASH", "CHEQUE", "NEFT", "DD", "UPI", "CARD"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Reference</span>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Cheque / UTR number"
          className="w-56 rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
      >
        Record payment
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
      >
        Cancel
      </button>
    </form>
  );
}

function ConcessionPanel({
  items,
  canApprove,
  busy,
  onCreate,
  onDecide,
}: {
  items: Record<string, unknown>[];
  canApprove: boolean;
  busy: boolean;
  onCreate: (body: Record<string, unknown>) => void;
  onDecide: (id: string, status: "APPROVED" | "REJECTED") => void;
}) {
  const [student, setStudent] = useState<DirectoryOption | null>(null);
  const [form, setForm] = useState({
    name: "",
    concessionType: "SCHOLARSHIP",
    percentage: "",
    amount: "",
    reason: "",
  });

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">
        Scholarships & concessions
      </h2>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!student) return;
          onCreate({
            studentId: student.id,
            name: form.name,
            concessionType: form.concessionType,
            percentage: form.percentage ? Number(form.percentage) : undefined,
            amount: form.amount ? Number(form.amount) : undefined,
            reason: form.reason || undefined,
          });
          setStudent(null);
          setForm({ ...form, name: "", percentage: "", amount: "", reason: "" });
        }}
        className="grid gap-3 rounded-2xl bg-slate-50 p-5 sm:grid-cols-5"
      >
        <div className="sm:col-span-2">
          <EntityPicker
            kind="student"
            label="Student"
            value={student}
            onChange={setStudent}
            required
          />
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Merit scholarship"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">
            Percentage
          </span>
          <input
            value={form.percentage}
            onChange={(e) =>
              setForm({ ...form, percentage: e.target.value, amount: "" })
            }
            placeholder="25"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">
            or Amount
          </span>
          <input
            value={form.amount}
            onChange={(e) =>
              setForm({ ...form, amount: e.target.value, percentage: "" })
            }
            placeholder="15000"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !student}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 sm:w-48"
        >
          Submit for approval
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No concessions recorded.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li
              key={String(item.id)}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  {String(item.studentName)} · {String(item.name)}
                </p>
                <p className="text-xs text-slate-500">
                  {item.percentage
                    ? `${item.percentage}%`
                    : money(Number(item.amount ?? 0))}{" "}
                  · {String(item.concessionType)} · {String(item.status)}
                </p>
              </div>
              {canApprove && item.status === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDecide(String(item.id), "APPROVED")}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDecide(String(item.id), "REJECTED")}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
