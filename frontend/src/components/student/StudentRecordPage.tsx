"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
} from "@/lib/auth";
import {
  getMyStudentPortal,
  StudentPortalData,
} from "@/lib/portalApi";

type View =
  | "profile"
  | "fees"
  | "results"
  | "examinations";

function money(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function date(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const VIEW_TITLES: Record<View, string> = {
  profile: "My Profile",
  fees: "Fees",
  results: "Results",
  examinations: "Examinations",
};

export function StudentRecordPage({
  view,
}: {
  view: View;
}) {
  const router = useRouter();

  const [data, setData] =
    useState<StudentPortalData | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getMyStudentPortal();

      setData(result);
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }

      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load your student record.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell
      title={VIEW_TITLES[view]}
      subtitle="Student workspace"
      allowedRoles={["STUDENT"]}
    >
      <main className="mx-auto w-full max-w-5xl space-y-5">
        {loading ? (
          <div
            className="space-y-4"
            aria-label="Loading student record"
            aria-busy="true"
          >
            <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-56 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5"
          >
            <p className="text-sm font-semibold text-red-900">
              Unable to load this page
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-lg bg-red-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error && data ? (
          <Content
            view={view}
            data={data}
          />
        ) : null}
      </main>
    </DashboardShell>
  );
}

function Content({
  view,
  data,
}: {
  view: View;
  data: StudentPortalData;
}) {
  if (view === "profile") {
    const profile = data.student.profile;
    const enrollment = data.enrollment;

    const outstandingFees = data.fees.reduce(
      (sum, item) => sum + item.balance,
      0,
    );

    return (
      <>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Student profile
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {data.student.firstName}{" "}
                {data.student.lastName}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {data.student.email}
                {data.student.phone
                  ? ` · ${data.student.phone}`
                  : ""}
              </p>
            </div>

            <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Student
            </span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card title="Academic record">
            <Row
              label="Admission number"
              value={
                profile?.admissionNumber || "—"
              }
            />

            <Row
              label="Program"
              value={
                enrollment?.program.name || "—"
              }
            />

            <Row
              label="Academic year"
              value={
                enrollment?.academicYear.name || "—"
              }
            />

            <Row
              label="Section"
              value={
                enrollment?.section
                  ? `${enrollment.section.semester.name} · ${enrollment.section.name}`
                  : "—"
              }
            />
          </Card>

          <Card title="Academic summary">
            <Row
              label="Attendance"
              value={`${data.attendance.percentage}%`}
            />

            <Row
              label="Subjects with marks"
              value={String(data.marks.length)}
            />

            <Row
              label="Outstanding fees"
              value={money(outstandingFees)}
            />

            <Row
              label="Documents"
              value={String(data.documents.length)}
            />
          </Card>

          <Card title="Parents & guardians">
            {data.parents.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">
                No linked parent or guardian account is available.
              </p>
            ) : (
              <div className="space-y-3">
                {data.parents.map((link) => (
                  <div
                    key={link.parent.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {link.parent.firstName} {link.parent.lastName}
                        </p>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {link.relationship || "Parent / guardian"}
                        </p>
                      </div>
                      <div className="text-left text-sm text-slate-600 sm:text-right">
                        <p>{link.parent.email}</p>
                        {link.parent.phone ? <p>{link.parent.phone}</p> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </>
    );
  }

  if (view === "fees") {
    return (
      <List
        title="Fee records"
        empty="No fee records are available."
        items={data.fees.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                {item.title}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Due {date(item.dueDate)} · {item.status}
              </p>
            </div>

            <p className="shrink-0 text-left text-sm sm:text-right">
              <span className="font-medium text-slate-800">
                {money(item.paid)} paid
              </span>

              <br />

              <span className="text-slate-500">
                {money(item.balance)} balance
              </span>
            </p>
          </div>
        ))}
      />
    );
  }

  if (view === "results") {
    return (
      <List
        title="Published results"
        empty="No examination results have been published."
        items={data.exams
          .filter((item) => item.result)
          .map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {item.course.code} · {item.title}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {date(item.examDate)}
                </p>
              </div>

              <p className="shrink-0 text-sm font-bold text-slate-900">
                {item.result?.marks}/{item.maxMarks}
              </p>
            </div>
          ))}
      />
    );
  }

  if (view === "examinations") {
    return (
      <List
        title="Examinations"
        empty="No examinations are scheduled."
        items={data.exams.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                {item.course.code} · {item.title}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {date(item.examDate)}
              </p>
            </div>

            <p className="shrink-0 text-sm text-slate-600">
              Max {item.maxMarks}
            </p>
          </div>
        ))}
      />
    );
  }

  return null;
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 text-sm last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-slate-500">
        {label}
      </span>

      <span className="font-medium text-slate-800 sm:text-right">
        {value}
      </span>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 font-semibold text-slate-950">
        {title}
      </h2>

      <div>{children}</div>
    </section>
  );
}

function List({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: React.ReactNode[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-4">
        <h1 className="font-semibold text-slate-950">
          {title}
        </h1>
      </header>

      {items.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <article
              key={index}
              className="p-5"
            >
              {item}
            </article>
          ))}
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-slate-500">
          {empty}
        </p>
      )}
    </section>
  );
}
