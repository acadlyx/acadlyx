"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import {
  ChildSummary,
  getChildAttendance,
  getChildCoursework,
  getChildFees,
  getChildNotices,
  getChildResults,
  listMyChildren,
} from "@/lib/parentApi";

/**
 * Per-child parent view.
 *
 * Each tab is a separate authorized call: the backend re-verifies the
 * parent-child link every time, so switching child or tab never widens
 * what this page can reach.
 */

type Tab = "attendance" | "results" | "fees" | "coursework" | "notices";

const TABS: Tab[] = ["attendance", "results", "fees", "coursework", "notices"];

const currency = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ParentChildrenPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("attendance");
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError("");
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

  useEffect(() => {
    void run(async () => {
      const list = await listMyChildren();
      setChildren(list);
      if (list.length > 0) setSelected(list[0].studentId);
    });
  }, [run]);

  useEffect(() => {
    if (!selected) return;
    void run(async () => {
      const loader =
        tab === "attendance"
          ? getChildAttendance
          : tab === "results"
          ? getChildResults
          : tab === "fees"
          ? getChildFees
          : tab === "coursework"
          ? getChildCoursework
          : getChildNotices;
      setPayload(await loader(selected));
    });
  }, [selected, tab, run]);

  const child = children.find((entry) => entry.studentId === selected) ?? null;

  return (
    <DashboardShell
      title="My children"
      subtitle="Attendance, results, fees, coursework and notices"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {children.length === 0 ? (
          <p className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            No students are linked to this account. Ask the institution office
            to link your child.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              {children.map((entry) => (
                <button
                  key={entry.studentId}
                  type="button"
                  onClick={() => setSelected(entry.studentId)}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    entry.studentId === selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <span className="block font-semibold">{entry.name}</span>
                  <span className="block text-xs opacity-80">
                    {entry.enrollment?.rollNumber ?? "—"} ·{" "}
                    {entry.enrollment?.program?.code ?? "—"}
                  </span>
                </button>
              ))}
            </div>

            {child && (
              <section className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Attendance
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {child.attendance.percentage === null
                      ? "—"
                      : `${child.attendance.percentage.toFixed(1)}%`}
                  </p>
                  <p className="text-xs text-slate-500">
                    Requires {child.attendance.requiredPercentage}% ·{" "}
                    {child.attendance.level}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Outstanding fees
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {currency(child.outstandingFees)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Semester
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {child.enrollment?.semester?.number ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {child.enrollment?.section?.name ?? "—"}
                  </p>
                </div>
              </section>
            )}

            <div className="flex flex-wrap gap-2">
              {TABS.map((key) => (
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
                  {key}
                </button>
              ))}
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {busy && <p className="text-sm text-slate-500">Loading…</p>}
              {!busy && payload && <ChildPanel tab={tab} payload={payload} />}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function ChildPanel({
  tab,
  payload,
}: {
  tab: Tab;
  payload: Record<string, unknown>;
}) {
  if (tab === "attendance") {
    const recent =
      (payload.recent as Array<{
        sessionDate: string;
        status: string;
        courseCode: string;
      }>) ?? [];
    return (
      <>
        <h2 className="text-lg font-bold text-slate-900">Recent sessions</h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {recent.map((row, index) => (
            <li
              key={`${row.sessionDate}-${index}`}
              className="flex items-center justify-between py-2"
            >
              <span>
                {new Date(row.sessionDate).toLocaleDateString()} ·{" "}
                {row.courseCode}
              </span>
              <span
                className={
                  row.status === "PRESENT"
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-red-600"
                }
              >
                {row.status}
              </span>
            </li>
          ))}
          {recent.length === 0 && (
            <li className="py-2 text-slate-500">No attendance recorded yet.</li>
          )}
        </ul>
      </>
    );
  }

  if (tab === "results") {
    const transcript = payload.transcript as
      | { cgpa: number | null; semesters: Array<Record<string, unknown>> }
      | undefined;
    return (
      <>
        <h2 className="text-lg font-bold text-slate-900">
          CGPA {transcript?.cgpa ?? "—"}
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(transcript?.semesters ?? []).map((semester, index) => (
            <li key={index} className="rounded-xl bg-slate-50 px-4 py-3">
              {String(semester.semesterName ?? `Semester ${index + 1}`)} · SGPA{" "}
              {String(semester.sgpa ?? "—")}
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (tab === "fees") {
    const summary = payload.summary as
      | { billed: number; paid: number; outstanding: number }
      | undefined;
    const invoices =
      (payload.invoices as Array<{
        id: string;
        title: string;
        outstanding: number;
        dueDate: string | null;
        status: string;
      }>) ?? [];
    return (
      <>
        <h2 className="text-lg font-bold text-slate-900">
          Outstanding {currency(summary?.outstanding ?? 0)}
        </h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex items-center justify-between py-2"
            >
              <span>
                {invoice.title}
                <span className="ml-2 text-xs text-slate-400">
                  {invoice.dueDate
                    ? new Date(invoice.dueDate).toLocaleDateString()
                    : "—"}
                </span>
              </span>
              <span className="font-semibold">
                {currency(invoice.outstanding)} · {invoice.status}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (tab === "coursework") {
    const assignments =
      (payload.assignments as Array<{
        id: string;
        title: string;
        courseCode: string;
        dueDate: string | null;
        submittedAt: string | null;
        marksAwarded: number | null;
        maxMarks: number | null;
      }>) ?? [];
    return (
      <>
        <h2 className="text-lg font-bold text-slate-900">Assignments</h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex items-center justify-between py-2"
            >
              <span>
                {assignment.courseCode} · {assignment.title}
              </span>
              <span
                className={
                  assignment.submittedAt
                    ? "text-emerald-700"
                    : "text-amber-700"
                }
              >
                {assignment.submittedAt
                  ? assignment.marksAwarded !== null
                    ? `${assignment.marksAwarded}/${assignment.maxMarks}`
                    : "Submitted"
                  : "Not submitted"}
              </span>
            </li>
          ))}
          {assignments.length === 0 && (
            <li className="py-2 text-slate-500">No assignments published.</li>
          )}
        </ul>
      </>
    );
  }

  const notices =
    (payload.notices as Array<{
      id: string;
      title: string;
      body: string;
      publishedAt: string;
    }>) ?? [];
  return (
    <>
      <h2 className="text-lg font-bold text-slate-900">Notices</h2>
      <ul className="mt-3 space-y-3 text-sm">
        {notices.map((notice) => (
          <li key={notice.id} className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="font-semibold text-slate-900">{notice.title}</p>
            <p className="mt-1 text-slate-600">{notice.body}</p>
            <p className="mt-1 text-xs text-slate-400">
              {new Date(notice.publishedAt).toLocaleDateString()}
            </p>
          </li>
        ))}
        {notices.length === 0 && (
          <li className="text-slate-500">No notices right now.</li>
        )}
      </ul>
    </>
  );
}
