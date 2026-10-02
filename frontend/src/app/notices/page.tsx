"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  getCurrentUser,
} from "@/lib/auth";
import {
  createNotice,
  ErpNotice,
  listDepartments,
  listNotices,
} from "@/lib/erpApi";

const READ_ROLES = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "DIRECTOR",
  "MANAGEMENT",
  "DEAN",
  "REGISTRAR",
  "HOD",
  "FACULTY",
  "ACCOUNTS",
  "HR",
  "ADMISSIONS",
  "EXAMINATION",
  "LIBRARIAN",
  "PLACEMENT",
  "IT",
  "STAFF",
  "STUDENT",
  "PARENT",
];

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function audienceLabel(audience?: string) {
  switch ((audience || "ALL").toUpperCase()) {
    case "STUDENT":
    case "STUDENTS":
      return "Students";
    case "PARENT":
    case "PARENTS":
      return "Parents";
    case "FACULTY":
    case "TEACHERS":
      return "Faculty";
    case "STAFF":
      return "Staff";
    case "ADMIN":
      return "Administration";
    case "LEADERSHIP":
      return "Leadership";
    default:
      return "Everyone";
  }
}

function noticeAccent(audience?: string) {
  const value = (audience || "ALL").toUpperCase();

  if (value.includes("STUDENT")) {
    return "bg-blue-50 text-blue-700";
  }

  if (value.includes("PARENT")) {
    return "bg-violet-50 text-violet-700";
  }

  if (
    value.includes("FACULTY") ||
    value.includes("TEACH")
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (value === "STAFF") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default function NoticesPage() {
  const router = useRouter();

  const [notices, setNotices] = useState<ErpNotice[]>([]);
  const [departments, setDepartments] = useState<
    Array<{ id: string; name: string; code?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPublisher, setShowPublisher] = useState(false);

  const [form, setForm] = useState({
    title: "",
    body: "",
    audience: "ALL",
    departmentId: "",
    expiresAt: "",
  });

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const department of departments) {
      map.set(department.id, department.name);
    }

    return map;
  }, [departments]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const user = await getCurrentUser();
      const manage = user.permissions.includes("notices.manage");

      setCanManage(manage);

      const [noticeList, departmentList] = await Promise.all([
        listNotices(false),
        manage ? listDepartments() : Promise.resolve([]),
      ]);

      setNotices(noticeList);
      setDepartments(departmentList);
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }

      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load notices."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and message are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createNotice({
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience,
        departmentId: form.departmentId || undefined,
        expiresAt: form.expiresAt || undefined,
      });

      setForm({
        title: "",
        body: "",
        audience: "ALL",
        departmentId: "",
        expiresAt: "",
      });

      setSuccess("Notice published successfully.");
      setShowPublisher(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to publish notice."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      title="Notices"
      subtitle="Institution communications"
      allowedRoles={READ_ROLES}
    >
      <main className="mx-auto max-w-[1180px] space-y-5 pb-10">
        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(20,32,50,0.04)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                Communication centre
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] text-slate-900">
                Notices
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                View notices available to this account. Department-specific
                notices are filtered by the server according to your academic
                or institutional scope.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-[18px] bg-slate-50 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Available notices
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {loading ? "—" : notices.length}
                </p>
              </div>

              {canManage ? (
                <button
                  type="button"
                  onClick={() => setShowPublisher((value) => !value)}
                  className="rounded-[14px] bg-blue-600 px-4 py-3 text-sm font-extrabold text-white shadow-[0_7px_18px_rgba(37,99,235,0.2)] transition hover:bg-blue-700"
                >
                  {showPublisher ? "Close publisher" : "Publish notice"}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {showPublisher && canManage ? (
          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(20,32,50,0.04)] sm:p-7">
            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Publisher
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-800">
                Create institution notice
              </h2>
            </div>

            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Title
                  </span>
                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Notice title"
                    className="w-full rounded-[13px] border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Audience
                  </span>
                  <select
                    value={form.audience}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        audience: event.target.value,
                      }))
                    }
                    className="w-full rounded-[13px] border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="ALL">Everyone</option>
                    <option value="STUDENTS">Students</option>
                    <option value="PARENTS">Parents</option>
                    <option value="FACULTY">Faculty</option>
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Administration</option>
                    <option value="LEADERSHIP">Leadership</option>
                  </select>
                </label>
              </div>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Message
                </span>
                <textarea
                  value={form.body}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  rows={6}
                  placeholder="Write the notice…"
                  className="w-full resize-y rounded-[13px] border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Department scope
                  </span>
                  <select
                    value={form.departmentId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        departmentId: event.target.value,
                      }))
                    }
                    className="w-full rounded-[13px] border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">All departments</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                        {department.code ? ` (${department.code})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Expiry
                  </span>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        expiresAt: event.target.value,
                      }))
                    }
                    className="w-full rounded-[13px] border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[13px] bg-blue-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_7px_16px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Publishing…" : "Publish notice"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="space-y-3">
          {loading ? (
            [1, 2, 3].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-[24px] border border-slate-200 bg-white p-5"
              >
                <div className="h-4 w-40 rounded bg-slate-100" />
                <div className="mt-4 h-3 w-3/4 rounded bg-slate-100" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
              </div>
            ))
          ) : notices.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-[15px] bg-slate-100 text-slate-500">
                ◌
              </div>
              <h2 className="mt-4 text-base font-black text-slate-800">
                No active notices
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                Notices available to this account will appear here.
              </p>
            </div>
          ) : (
            notices.map((notice) => (
              <article
                key={notice.id}
                className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_7px_24px_rgba(20,32,50,0.035)] sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${noticeAccent(
                          notice.audience
                        )}`}
                      >
                        {audienceLabel(notice.audience)}
                      </span>

                      {notice.departmentId ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                          {departmentNameById.get(notice.departmentId) ||
                            "Department notice"}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-lg font-black tracking-[-0.02em] text-slate-900">
                      {notice.title}
                    </h2>
                  </div>

                  <time className="shrink-0 text-[11px] font-semibold text-slate-400">
                    {formatDate(notice.publishedAt)}
                  </time>
                </div>

                <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {notice.body}
                </div>

                {notice.expiresAt ? (
                  <div className="mt-5 border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-400">
                    Available until {formatDate(notice.expiresAt)}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
