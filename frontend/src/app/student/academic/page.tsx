"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import {
  getMyStudentPortal,
  StudentPortalData,
} from "@/lib/portalApi";

function percent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export default function StudentAcademicPage() {
  const [data, setData] = useState<StudentPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getMyStudentPortal());
    } catch (reason) {
      setError(
        reason instanceof AuthRequiredError
          ? "Your session has expired. Please sign in again."
          : reason instanceof Error
            ? reason.message
            : "Unable to load your academic record.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell
      title="Academic record"
      subtitle="Your current enrollment, subjects, assessment and academic progress"
      allowedRoles={["STUDENT"]}
    >
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/student"
            className="text-sm font-bold text-slate-600 hover:text-slate-900"
          >
            ← Back to dashboard
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200"
              />
            ))}
          </div>
        ) : error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-bold text-red-900">
              Academic record could not be loaded
            </h2>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              Try again
            </button>
          </section>
        ) : data ? (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-acadlyx-primary">
                Current enrollment
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Info label="Program" value={data.enrollment?.program.name || "Not assigned"} />
                <Info label="Academic year" value={data.enrollment?.academicYear.name || "Not assigned"} />
                <Info
                  label="Semester / section"
                  value={
                    data.enrollment?.section
                      ? `Semester ${data.enrollment.section.semester.number} · ${data.enrollment.section.name}`
                      : "Not assigned"
                  }
                />
                <Info
                  label="Enrollment status"
                  value={data.enrollment ? "Active record" : "No enrollment"}
                />
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Attendance" value={percent(data.attendance.percentage)} />
              <Metric label="Subjects" value={String(data.courseOfferings.length)} />
              <Metric label="Assignments" value={String(data.assignments.length)} />
              <Metric label="Examinations" value={String(data.exams.length)} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardCard title="Current subjects">
                {data.courseOfferings.length === 0 ? (
                  <Empty text="No active course offerings are assigned to your section." />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.courseOfferings.map((offering) => (
                      <div
                        key={offering.id}
                        className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {offering.course.code} · {offering.course.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {offering.course.credits} credits
                            {offering.faculty
                              ? ` · ${offering.faculty.firstName} ${offering.faculty.lastName}`
                              : ""}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          {offering.course.department?.name || "Department"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>

              <DashboardCard title="Attendance by subject">
                {data.attendance.subjects.length === 0 ? (
                  <Empty text="No attendance has been recorded yet." />
                ) : (
                  <div className="space-y-4">
                    {data.attendance.subjects.map((subject) => (
                      <div key={subject.courseId}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold text-slate-800">
                            {subject.code} · {subject.name}
                          </span>
                          <span className="font-bold text-slate-900">
                            {percent(subject.percentage)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-acadlyx-primary"
                            style={{
                              width: `${Math.min(100, Math.max(0, subject.percentage))}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {subject.present} present · {subject.absent} absent · {subject.late} late
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardCard title="Assessment results">
                {data.marks.length === 0 ? (
                  <Empty text="No internal marks are available yet." />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.marks.map((course) => (
                      <div key={course.courseOfferingId} className="py-4 first:pt-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">
                            {course.course.code} · {course.course.name}
                          </p>
                          <span className="text-sm font-black text-slate-900">
                            {course.totalObtained}/{course.totalMax}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {course.components.map((component) => (
                            <div
                              key={component.id}
                              className="rounded-xl bg-slate-50 p-3"
                            >
                              <p className="text-xs font-semibold text-slate-500">
                                {component.component}
                              </p>
                              <p className="mt-1 font-bold text-slate-900">
                                {component.marksObtained}/{component.maxMarks}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>

              <DashboardCard title="Upcoming and recent academic work">
                {data.assignments.length === 0 ? (
                  <Empty text="No published assignments are currently available." />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.assignments.slice(0, 8).map((assignment) => (
                      <div key={assignment.id} className="py-4 first:pt-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {assignment.course.code} · {assignment.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Due {date(assignment.dueDate)}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-slate-500">
                            {assignment.submission?.status || assignment.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <DashboardCard title="Examinations">
                {data.exams.length === 0 ? (
                  <Empty text="No examinations are scheduled." />
                ) : (
                  <div className="space-y-3">
                    {data.exams.slice(0, 6).map((exam) => (
                      <div key={exam.id} className="rounded-xl border border-slate-100 p-3">
                        <p className="font-semibold text-slate-900">
                          {exam.course.code} · {exam.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {date(exam.examDate)} · Max {exam.maxMarks}
                        </p>
                        {exam.result ? (
                          <p className="mt-1 text-xs font-bold text-slate-700">
                            Result: {exam.result.marks}/{exam.maxMarks}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>

              <DashboardCard title="Fees">
                {data.fees.length === 0 ? (
                  <Empty text="No fee records are available." />
                ) : (
                  <div className="space-y-3">
                    {data.fees.slice(0, 6).map((fee) => (
                      <div key={fee.id} className="rounded-xl border border-slate-100 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">{fee.title}</p>
                          <span className="text-sm font-bold text-slate-900">
                            ₹{fee.balance.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Due {date(fee.dueDate)} · {fee.status}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>

              <DashboardCard title="Quick links">
                <div className="grid gap-2">
                  <Link href="/student/timetable" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Timetable</Link>
                  <Link href="/student/attendance" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Attendance</Link>
                  <Link href="/student/marks" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Marks</Link>
                  <Link href="/student/examinations" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Examinations</Link>
                  <Link href="/student/fees" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Fees</Link>
                </div>
              </DashboardCard>
            </div>
          </>
        ) : null}
      </main>
    </DashboardShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{text}</p>;
}
