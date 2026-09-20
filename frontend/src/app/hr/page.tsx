"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import {
  DepartmentOption,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  EligibleUser,
  Employee,
  EmployeeStatus,
  EmploymentType,
  createEmployee,
  listDepartmentOptions,
  listEligibleUsers,
  listEmployees,
  updateEmployeeStatus,
} from "@/lib/hrApi";

type ViewState = "loading" | "ready" | "error";

const STATUS_STYLES: Record<EmployeeStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ON_LEAVE: "bg-amber-100 text-amber-700",
  RESIGNED: "bg-slate-100 text-slate-500",
  TERMINATED: "bg-red-100 text-red-700",
  RETIRED: "bg-indigo-100 text-indigo-700",
};

const emptyForm = {
  userId: "",
  employeeCode: "",
  departmentId: "",
  designation: "",
  employmentType: "FULL_TIME" as EmploymentType,
  joiningDate: "",
  qualification: "",
};

export default function HrPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [items, setItems] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<{ byStatus: Record<string, number>; departments: number }>({
    byStatus: {},
    departments: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EmployeeStatus | "">("");

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    try {
      const [list, deptOptions, eligible] = await Promise.all([
        listEmployees({ page, search: search || undefined, status: status || undefined }),
        departments.length ? Promise.resolve(departments) : listDepartmentOptions(),
        listEligibleUsers(),
      ]);
      setItems(list.items);
      setSummary(list.summary);
      setTotalPages(list.totalPages);
      setDepartments(deptOptions);
      setEligibleUsers(eligible);
      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "Failed to load HR records");
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
    if (!form.userId || !form.employeeCode || !form.designation || !form.joiningDate) {
      setFormError("User, employee code, designation and joining date are required.");
      return;
    }
    setSubmitting(true);
    try {
      await createEmployee({
        userId: form.userId,
        employeeCode: form.employeeCode,
        departmentId: form.departmentId || undefined,
        designation: form.designation,
        employmentType: form.employmentType,
        joiningDate: form.joiningDate,
        qualification: form.qualification || undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      setPage(1);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create employee record");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, next: EmployeeStatus) {
    setActionError("");
    try {
      await updateEmployeeStatus(id, next);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <DashboardShell title="HR Management" subtitle="Employee records and departments">
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
              Human Resources
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              HR Management
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Live employee records for this institution — every row here is a real
              user account with an employment profile.
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
            {showForm ? "Close" : "Add employee"}
          </button>
        </section>

        {state === "loading" && <p className="text-sm text-slate-400">Loading HR records…</p>}

        {state === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {state === "ready" && (
          <>
            <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {EMPLOYEE_STATUSES.map((s) => (
                <article key={s} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {s.replace("_", " ")}
                  </p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                    {summary.byStatus[s] ?? 0}
                  </p>
                </article>
              ))}
            </section>

            {showForm && (
              <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6 sm:p-8">
                <h2 className="text-2xl font-black text-slate-950">Add employee</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Only user accounts with a staff-type role and no existing employee record show
                  up below.
                </p>
                {formError && (
                  <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
                    {formError}
                  </p>
                )}
                {eligibleUsers.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">
                    No eligible users found. Create a user with a staff role first.
                  </p>
                ) : (
                  <form onSubmit={handleCreate} className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Field label="User *">
                      <select
                        className="input"
                        value={form.userId}
                        onChange={(e) => setForm({ ...form, userId: e.target.value })}
                      >
                        <option value="">Select user</option>
                        {eligibleUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.firstName} {u.lastName} — {u.email}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Employee code *">
                      <input
                        className="input"
                        value={form.employeeCode}
                        onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                      />
                    </Field>
                    <Field label="Designation *">
                      <input
                        className="input"
                        value={form.designation}
                        onChange={(e) => setForm({ ...form, designation: e.target.value })}
                      />
                    </Field>
                    <Field label="Department">
                      <select
                        className="input"
                        value={form.departmentId}
                        onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                      >
                        <option value="">No department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code} — {d.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Employment type *">
                      <select
                        className="input"
                        value={form.employmentType}
                        onChange={(e) =>
                          setForm({ ...form, employmentType: e.target.value as EmploymentType })
                        }
                      >
                        {EMPLOYMENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Joining date *">
                      <input
                        type="date"
                        className="input"
                        value={form.joiningDate}
                        onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Qualification">
                        <input
                          className="input"
                          value={form.qualification}
                          onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {submitting ? "Saving…" : "Save employee"}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}

            <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Search by name, email, code, designation…"
                className="input sm:w-80"
              />
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as EmployeeStatus | "");
                }}
                className="input sm:w-56"
              >
                <option value="">All statuses</option>
                {EMPLOYEE_STATUSES.map((s) => (
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
                      <th className="px-5 py-4 font-bold">Employee</th>
                      <th className="px-5 py-4 font-bold">Department</th>
                      <th className="px-5 py-4 font-bold">Designation</th>
                      <th className="px-5 py-4 font-bold">Joined</th>
                      <th className="px-5 py-4 font-bold">Status</th>
                      <th className="px-5 py-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="font-semibold text-slate-800">
                            {emp.user.firstName} {emp.user.lastName}
                          </p>
                          <p className="text-xs text-slate-400">{emp.employeeCode}</p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {emp.department ? `${emp.department.code} — ${emp.department.name}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {emp.designation}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {new Date(emp.joiningDate).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[emp.status]}`}
                          >
                            {emp.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const next = e.target.value as EmployeeStatus;
                              if (next) handleStatusChange(emp.id, next);
                            }}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          >
                            <option value="">Change status…</option>
                            {EMPLOYEE_STATUSES.filter((s) => s !== emp.status).map((s) => (
                              <option key={s} value={s}>
                                {s.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                          No matching employees.
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
