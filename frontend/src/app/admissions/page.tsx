"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import {
  ADMISSION_STATUSES,
  AdmissionApplication,
  AdmissionStatus,
  AcademicYearOption,
  ProgramOption,
  changeAdmissionStatus,
  createAdmissionApplication,
  listAcademicYearOptions,
  listAdmissionApplications,
  listProgramOptions,
} from "@/lib/admissionsApi";

const STATUS_STYLES: Record<AdmissionStatus, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  DOCUMENTS_PENDING: "bg-orange-100 text-orange-700",
  SELECTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  ENROLLED: "bg-indigo-100 text-indigo-700",
  WITHDRAWN: "bg-slate-100 text-slate-500",
};

const NEXT_STATUS: Record<AdmissionStatus, AdmissionStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "DOCUMENTS_PENDING", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: ["DOCUMENTS_PENDING", "SELECTED", "REJECTED", "WITHDRAWN"],
  DOCUMENTS_PENDING: ["UNDER_REVIEW", "SELECTED", "REJECTED", "WITHDRAWN"],
  SELECTED: ["REJECTED", "WITHDRAWN"],
  REJECTED: [],
  ENROLLED: [],
  WITHDRAWN: [],
};

type ViewState = "loading" | "ready" | "error";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  guardianName: "",
  guardianPhone: "",
  previousInstitution: "",
  previousPercentage: "",
  remarks: "",
  programId: "",
  academicYearId: "",
};

export default function AdmissionsPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [items, setItems] = useState<AdmissionApplication[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdmissionStatus | "">("");

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    try {
      const [list, programOptions, yearOptions] = await Promise.all([
        listAdmissionApplications({
          page,
          search: search || undefined,
          status: status || undefined,
        }),
        programs.length ? Promise.resolve(programs) : listProgramOptions(),
        academicYears.length ? Promise.resolve(academicYears) : listAcademicYearOptions(),
      ]);
      setItems(list.items);
      setSummary(list.summary);
      setTotalPages(list.totalPages);
      setPrograms(programOptions);
      setAcademicYears(yearOptions);
      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "Failed to load admissions");
      setState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status, router]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [load, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.firstName || !form.lastName || !form.email || !form.programId || !form.academicYearId) {
      setFormError("First name, last name, email, program and academic year are required.");
      return;
    }
    setSubmitting(true);
    try {
      await createAdmissionApplication({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        guardianName: form.guardianName || undefined,
        guardianPhone: form.guardianPhone || undefined,
        previousInstitution: form.previousInstitution || undefined,
        previousPercentage: form.previousPercentage
          ? Number(form.previousPercentage)
          : undefined,
        remarks: form.remarks || undefined,
        programId: form.programId,
        academicYearId: form.academicYearId,
      });
      setForm(emptyForm);
      setShowForm(false);
      setPage(1);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create application");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, next: AdmissionStatus) {
    setActionError("");
    try {
      await changeAdmissionStatus(id, next);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <DashboardShell title="Admission Management" subtitle="Applications, review and selection">
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
              Admissions
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Admission Management
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Live application data for this institution — review, move through the
              selection pipeline, and enroll applicants.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError("");
            }}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            {showForm ? "Close" : "New admission"}
          </button>
        </section>

        {state === "loading" && (
          <p className="text-sm text-slate-400">Loading admissions…</p>
        )}

        {state === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {state === "ready" && (
          <>
            <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {ADMISSION_STATUSES.map((s) => (
                <article
                  key={s}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {s.replace("_", " ")}
                  </p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                    {summary[s] ?? 0}
                  </p>
                </article>
              ))}
            </section>

            {showForm && (
              <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6 sm:p-8">
                <h2 className="text-2xl font-black text-slate-950">New admission application</h2>
                {formError && (
                  <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
                    {formError}
                  </p>
                )}
                <form onSubmit={handleCreate} className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="First name *">
                    <input
                      className="input"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    />
                  </Field>
                  <Field label="Last name *">
                    <input
                      className="input"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    />
                  </Field>
                  <Field label="Email *">
                    <input
                      type="email"
                      className="input"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      className="input"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Program *">
                    <select
                      className="input"
                      value={form.programId}
                      onChange={(e) => setForm({ ...form, programId: e.target.value })}
                    >
                      <option value="">Select program</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Academic year *">
                    <select
                      className="input"
                      value={form.academicYearId}
                      onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
                    >
                      <option value="">Select academic year</option>
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Guardian name">
                    <input
                      className="input"
                      value={form.guardianName}
                      onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                    />
                  </Field>
                  <Field label="Guardian phone">
                    <input
                      className="input"
                      value={form.guardianPhone}
                      onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                    />
                  </Field>
                  <Field label="Previous institution">
                    <input
                      className="input"
                      value={form.previousInstitution}
                      onChange={(e) =>
                        setForm({ ...form, previousInstitution: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Previous percentage">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="input"
                      value={form.previousPercentage}
                      onChange={(e) =>
                        setForm({ ...form, previousPercentage: e.target.value })
                      }
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Remarks">
                      <textarea
                        rows={3}
                        className="input"
                        value={form.remarks}
                        onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {submitting ? "Submitting…" : "Submit application"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Search by name, email, application number…"
                className="input sm:w-80"
              />
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as AdmissionStatus | "");
                }}
                className="input sm:w-56"
              >
                <option value="">All statuses</option>
                {ADMISSION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </section>

            {actionError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {actionError}
              </div>
            )}

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-bold">Applicant</th>
                      <th className="px-5 py-4 font-bold">Program</th>
                      <th className="px-5 py-4 font-bold">Application #</th>
                      <th className="px-5 py-4 font-bold">Status</th>
                      <th className="px-5 py-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="font-semibold text-slate-800">
                            {app.firstName} {app.lastName}
                          </p>
                          <p className="text-xs text-slate-400">{app.email}</p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {app.program?.code} · {app.academicYear?.name}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {app.applicationNumber}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[app.status]}`}
                          >
                            {app.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          {NEXT_STATUS[app.status].length > 0 ? (
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                const next = e.target.value as AdmissionStatus;
                                if (next) handleStatusChange(app.id, next);
                              }}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            >
                              <option value="">Move to…</option>
                              {NEXT_STATUS[app.status].map((s) => (
                                <option key={s} value={s}>
                                  {s.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400">No actions</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">
                          No matching applications.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </section>
          </>
        )}
      </main>
      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.65rem 0.9rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: rgb(129 140 248);
          box-shadow: 0 0 0 3px rgb(224 231 255);
        }
      `}</style>
    </DashboardShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
