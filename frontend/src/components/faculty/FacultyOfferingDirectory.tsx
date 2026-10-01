"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getMyFacultyCourseOfferings } from "@/lib/facultyApi";
import { FacultyCourseOffering } from "@/types/faculty";

type ViewState = "loading" | "ready" | "error";

type OfferingAction = "attendance" | "marks" | "assignments";

const ACTION_HREF: Record<
  OfferingAction,
  { label: string; href: (offeringId: string) => string }
> = {
  attendance: {
    label: "Attendance",
    href: (offeringId) => `/faculty/attendance/${offeringId}`,
  },
  marks: {
    label: "Marks",
    href: (offeringId) => `/faculty/marks/${offeringId}`,
  },
  assignments: {
    label: "Assignments",
    href: (offeringId) =>
      `/faculty/assignments?courseOfferingId=${offeringId}`,
  },
};

const ACTIONS: OfferingAction[] = [
  "attendance",
  "marks",
  "assignments",
];

function OfferingSkeleton() {
  return (
    <DashboardCard>
      <div className="space-y-3">
        <div className="acadlyx-skeleton h-4 w-48 rounded" />
        <div className="acadlyx-skeleton h-3 w-32 rounded" />
        <div className="acadlyx-skeleton mt-2 h-9 w-full rounded-lg" />
      </div>
    </DashboardCard>
  );
}

/**
 * Shared faculty course directory.
 *
 * Faculty hold `course-offerings.read`, `attendance.read/mark`,
 * `marks.read/enter` and `assignments.read/create`, so every offering
 * here links to the existing per-offering workspaces. The backend still
 * scopes each request to the signed-in faculty member.
 */
export function FacultyOfferingDirectory({
  title,
  subtitle,
  focus,
}: {
  title: string;
  subtitle: string;
  focus: OfferingAction;
}) {
  const router = useRouter();

  const [state, setState] = useState<ViewState>("loading");
  const [offerings, setOfferings] = useState<FacultyCourseOffering[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");

    try {
      const list = await getMyFacultyCourseOfferings();
      setOfferings(list);
      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your courses."
      );
      setState("error");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedActions = [
    focus,
    ...ACTIONS.filter((action) => action !== focus),
  ];

  return (
    <DashboardShell
      title={title}
      subtitle={subtitle}
      allowedRoles={["FACULTY"]}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
            Teaching
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            {subtitle}
          </p>
        </section>

        {state === "loading" && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <OfferingSkeleton key={index} />
            ))}
          </div>
        )}

        {state === "error" && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5"
          >
            <p className="font-bold text-red-900">
              Courses could not be loaded
            </p>

            <p className="mt-1 text-sm text-red-700">{error}</p>

            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {state === "ready" && offerings.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-bold text-slate-900">
              No course assignments yet
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Once the institution assigns you to a course offering,
              it will appear here.
            </p>
          </div>
        )}

        {state === "ready" && offerings.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {offerings.map((offering) => (
              <DashboardCard key={offering.id}>
                <p className="text-sm font-bold text-slate-900">
                  {offering.course.code}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {offering.course.name}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Section {offering.section.name} ·{" "}
                  {offering.semester.name} ·{" "}
                  {offering.semester.academicYear.name}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {orderedActions.map((action) => (
                    <Link
                      key={action}
                      href={ACTION_HREF[action].href(offering.id)}
                      className={`rounded-lg px-2 py-2 text-center text-xs font-semibold transition ${
                        action === focus
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {ACTION_HREF[action].label}
                    </Link>
                  ))}
                </div>
              </DashboardCard>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
