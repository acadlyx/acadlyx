"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { listInvoices, type InvoiceSummary } from "@/lib/billingApi";
import { authedFetch } from "@/lib/auth";

type Department = {
  id: string;
  name: string;
  code?: string | null;
};

type DepartmentEnvelope = {
  success: boolean;
  data: Department[];
};

const money = (value: number) =>
  value.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });

export default function DepartmentFeesPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [invoices, setInvoices] = useState<Awaited<ReturnType<typeof listInvoices>>["items"]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [departmentResult, user] = await Promise.all([
        authedFetch<DepartmentEnvelope>(
          "/departments?page=1&pageSize=100&isActive=true"
        ),
        getCurrentUser(),
      ]);

      const availableDepartments = Array.isArray(departmentResult.data)
        ? departmentResult.data
        : [];

      const isHod = user?.roles?.some((role) => role.toUpperCase() === "HOD");

      setDepartments(availableDepartments);

      let selected = departmentId;

      if (isHod && !selected && availableDepartments.length === 1) {
        selected = availableDepartments[0].id;
        setDepartmentId(selected);
      }

      const result = await listInvoices({
        page: 1,
        departmentId: selected || undefined,
        search: search.trim() || undefined,
        overdueOnly: overdueOnly || undefined,
      });

      setInvoices(result.items);
      setSummary(result.summary);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load department fee data."
      );
    } finally {
      setLoading(false);
    }
  }, [departmentId, overdueOnly, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell
      title="Department Fees"
      subtitle="Department-level fee collection and student ledger visibility"
      allowedRoles={["DEAN", "HOD"]}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            Scoped finance view
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">
            Department collection
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            View fee collection for authorised departments and filter the
            ledger to a specific student. This workspace does not expose
            fee-structure configuration, payment collection, refunds or
            concessions.
          </p>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr_auto_auto] lg:items-end">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-slate-700">
                Department
              </span>
              <select
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">All authorised departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.code ? department.code + " — " : ""}
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-semibold text-slate-700">
                Student / invoice search
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or invoice number"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>

            <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(event) => setOverdueOnly(event.target.checked)}
              />
              Overdue only
            </label>

            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-acadlyx-primary px-4 py-2.5 text-sm font-bold text-white"
            >
              Refresh
            </button>
          </div>
        </section>

        {summary ? (
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
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {money(Number(value))}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Student fee ledger
              </h2>
              <p className="text-sm text-slate-500">
                {loading ? "Loading…" : invoices.length + " records in this view"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Loading fee records…
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No fee records match the selected scope.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-3">Invoice</th>
                    <th className="pb-3">Student</th>
                    <th className="pb-3">Due</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Outstanding</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="py-3 font-semibold text-slate-900">
                        {invoice.invoiceNumber ?? "—"}
                        <span className="block text-xs font-normal text-slate-400">
                          {invoice.title}
                        </span>
                      </td>
                      <td className="py-3 text-slate-700">
                        {invoice.studentName ?? "—"}
                      </td>
                      <td className="py-3 text-slate-600">
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-3 text-slate-700">
                        {money(invoice.amount + invoice.lateFeeAmount)}
                      </td>
                      <td className="py-3 font-bold text-slate-900">
                        {money(invoice.outstanding)}
                      </td>
                      <td className="py-3">
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
