"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import {
  AuthRequiredError,
  isAuthenticated,
} from "@/lib/auth";
import {
  getStudentPortal,
  StudentPortalData,
} from "@/lib/portalApi";

type ViewState = "loading" | "ready" | "error";

function money(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function dateLabel(
  value: string | null | undefined
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function percentage(value: number): string {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function ParentStudentPortalPage() {
  const router = useRouter();
  const params = useParams<{
    studentId: string;
  }>();

  const studentId = params.studentId;

  const [state, setState] =
    useState<ViewState>("loading");

  const [data, setData] =
    useState<StudentPortalData | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    if (!studentId) {
      setErrorMessage("Student ID is missing.");
      setState("error");
      return;
    }

    let mounted = true;

    getStudentPortal(studentId)
      .then((result) => {
        if (!mounted) return;

        setData(result);
        setState("ready");
      })
      .catch((error: Error) => {
        if (!mounted) return;

        if (error instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }

        setErrorMessage(
          error.message ||
            "Unable to load student portal."
        );

        setState("error");
      });

    return () => {
      mounted = false;
    };
  }, [router, studentId]);

  const totals = useMemo(() => {
    if (!data) {
      return {
        fees: 0,
        paid: 0,
        balance: 0,
        pendingAssignments: 0,
      };
    }

    const fees = data.fees.reduce(
      (sum, invoice) => sum + invoice.amount,
      0
    );

    const paid = data.fees.reduce(
      (sum, invoice) => sum + invoice.paid,
      0
    );

    const balance = data.fees.reduce(
      (sum, invoice) => sum + invoice.balance,
      0
    );

    const pendingAssignments =
      data.assignments.filter(
        (assignment) =>
          !assignment.submission ||
          assignment.overdue
      ).length;

    return {
      fees,
      paid,
      balance,
      pendingAssignments,
    };
  }, [data]);

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading student portal…
        </p>
      </main>
    );
  }

  if (state === "error" || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center">
          <p className="font-semibold text-red-600">
            Unable to open student portal
          </p>

          <p className="mt-2 text-sm text-slate-500">
            {errorMessage}
          </p>

          <Link
            href="/parent"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Parent Portal
          </Link>
        </div>
      </main>
    );
  }

  const {
    student,
    enrollment,
    attendance,
    marks,
    assignments,
    fees,
    exams,
    documents,
    notifications,
  } = data;

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/parent"
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            ← Back to Parent Portal
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Student Academic Profile
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                {student.firstName}{" "}
                {student.lastName}
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                {student.email}
              </p>

              {student.profile
                ?.admissionNumber && (
                <p className="mt-2 text-xs font-medium text-slate-400">
                  Admission No:{" "}
                  {student.profile.admissionNumber}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Attendance
                </p>
                <p className="mt-1 text-xl font-bold">
                  {percentage(
                    attendance.percentage
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Courses
                </p>
                <p className="mt-1 text-xl font-bold">
                  {marks.length}
                </p>
              </div>

              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Balance
                </p>
                <p className="mt-1 text-xl font-bold">
                  {money(totals.balance)}
                </p>
              </div>

              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Alerts
                </p>
                <p className="mt-1 text-xl font-bold">
                  {notifications.unread}
                </p>
              </div>
            </div>
          </div>
        </section>

        {enrollment && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Program
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {enrollment.program.name}
                </p>
                <p className="text-xs text-slate-500">
                  {enrollment.program.code}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Academic Year
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {enrollment.academicYear.name}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Semester
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {enrollment.section?.semester.name ??
                    "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Section
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {enrollment.section?.name ?? "—"}
                </p>
              </div>
            </div>
          </section>
        )}

        <section
          id="attendance"
          className="mt-8 scroll-mt-6"
        >
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Academic Operations
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Attendance
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <DashboardCard title="Overall">
              <p className="text-3xl font-bold">
                {percentage(
                  attendance.percentage
                )}
              </p>
            </DashboardCard>

            <DashboardCard title="Present">
              <p className="text-3xl font-bold text-emerald-600">
                {attendance.present}
              </p>
            </DashboardCard>

            <DashboardCard title="Absent">
              <p className="text-3xl font-bold text-red-600">
                {attendance.absent}
              </p>
            </DashboardCard>

            <DashboardCard title="Late">
              <p className="text-3xl font-bold text-amber-600">
                {attendance.late}
              </p>
            </DashboardCard>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">
              Subject-wise attendance
            </h3>

            <div className="mt-4 divide-y divide-slate-100">
              {attendance.subjects.length === 0 ? (
                <p className="py-5 text-sm text-slate-500">
                  No attendance records available.
                </p>
              ) : (
                attendance.subjects.map((subject) => (
                  <div
                    key={subject.courseId}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {subject.code} —{" "}
                        {subject.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {subject.present} present ·{" "}
                        {subject.absent} absent ·{" "}
                        {subject.late} late
                      </p>
                    </div>

                    <span className="font-bold text-slate-900">
                      {percentage(
                        subject.percentage
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section
          id="marks"
          className="mt-10 scroll-mt-6"
        >
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Assessment
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Internal Marks
            </h2>
          </div>

          <div className="space-y-4">
            {marks.length === 0 ? (
              <DashboardCard>
                <p className="text-sm text-slate-500">
                  No internal marks are available yet.
                </p>
              </DashboardCard>
            ) : (
              marks.map((course) => (
                <div
                  key={course.courseOfferingId}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {course.course.code} —{" "}
                        {course.course.name}
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        {course.course.credits} credits
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-xl font-bold text-slate-900">
                        {course.totalObtained}/
                        {course.totalMax}
                      </p>

                      <p className="text-xs text-slate-500">
                        {percentage(
                          course.percentage
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 divide-y divide-slate-100 rounded-xl bg-slate-50">
                    {course.components.map(
                      (component) => (
                        <div
                          key={component.id}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <span className="text-sm text-slate-600">
                            {component.component}
                          </span>

                          <span className="text-sm font-semibold text-slate-900">
                            {component.marksObtained}/
                            {component.maxMarks}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section
          id="assignments"
          className="mt-10 scroll-mt-6"
        >
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Coursework
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Assignments
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            {assignments.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No published assignments.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="p-5"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {assignment.title}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          {assignment.course.code} · Due{" "}
                          {dateLabel(
                            assignment.dueDate
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {assignment.overdue && (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                            Overdue
                          </span>
                        )}

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {assignment.submission
                            ? assignment.submission
                                .status
                            : "Not submitted"}
                        </span>
                      </div>
                    </div>

                    {assignment.submission
                      ?.marksAwarded !== null &&
                      assignment.submission && (
                        <p className="mt-3 text-xs text-slate-500">
                          Marks:{" "}
                          <span className="font-semibold text-slate-800">
                            {
                              assignment.submission
                                .marksAwarded
                            }
                            /{assignment.maxMarks}
                          </span>
                        </p>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Examination
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Exams & Results
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            {exams.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No examinations available.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {exams.map((exam) => (
                  <div
                    key={exam.id}
                    className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {exam.title}
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        {exam.course.code} ·{" "}
                        {dateLabel(exam.examDate)}
                      </p>
                    </div>

                    {exam.result ? (
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-bold text-slate-900">
                          {exam.result.marks}/
                          {exam.maxMarks}
                        </p>

                        {exam.result.remarks && (
                          <p className="text-xs text-slate-500">
                            {exam.result.remarks}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                        Result pending
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          id="fees"
          className="mt-10 scroll-mt-6"
        >
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Finance
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Fees
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <DashboardCard title="Total">
              <p className="text-2xl font-bold">
                {money(totals.fees)}
              </p>
            </DashboardCard>

            <DashboardCard title="Paid">
              <p className="text-2xl font-bold text-emerald-600">
                {money(totals.paid)}
              </p>
            </DashboardCard>

            <DashboardCard title="Balance">
              <p className="text-2xl font-bold text-red-600">
                {money(totals.balance)}
              </p>
            </DashboardCard>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
            {fees.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No fee invoices available.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {fees.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="p-5"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {invoice.title}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Due{" "}
                          {dateLabel(
                            invoice.dueDate
                          )}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="font-bold text-slate-900">
                          {money(invoice.amount)}
                        </p>

                        <p className="text-xs text-slate-500">
                          Paid {money(invoice.paid)}
                        </p>

                        <p className="mt-1 text-sm font-semibold text-red-600">
                          Balance{" "}
                          {money(invoice.balance)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          id="documents"
          className="mt-10 scroll-mt-6"
        >
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Student Records
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Documents
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            {documents.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No documents are available.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">
                        {document.title}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {document.type} ·{" "}
                        {dateLabel(
                          document.createdAt
                        )}
                      </p>
                    </div>

                    <a
                      href={document.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Open document →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Communication
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Notifications
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            {notifications.items.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No notifications.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.items.map(
                  (notification) => (
                    <div
                      key={notification.id}
                      className="p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {notification.title}
                          </h3>

                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            {notification.body}
                          </p>
                        </div>

                        {!notification.readAt && (
                          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-900" />
                        )}
                      </div>

                      <p className="mt-3 text-[11px] text-slate-400">
                        {dateLabel(
                          notification.createdAt
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
