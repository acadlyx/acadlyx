"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch, getCurrentUser } from "@/lib/auth";

type FacultyMember = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
};

type Offering = {
  faculty?: FacultyMember | null;
  course?: { code?: string | null; name?: string | null } | null;
  semester?: { name?: string | null } | null;
  section?: { name?: string | null } | null;
};

type ResponseEnvelope = {
  success: boolean;
  data: Offering[];
};

export default function HodFacultyPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user?.roles?.some((role) => role.toUpperCase() === "HOD")) {
          setError("This workspace is available only to HOD users.");
          return;
        }

        const response = await authedFetch<ResponseEnvelope>(
          "/course-offerings?page=1&pageSize=100&isActive=true"
        );

        if (alive) setOfferings(response.data ?? []);
      } catch (reason) {
        if (!alive) return;
        setError(
          reason instanceof AuthRequiredError
            ? "Your session has expired. Please sign in again."
            : reason instanceof Error
              ? reason.message
              : "Unable to load department faculty."
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const faculty = useMemo(() => {
    const map = new Map<string, { member: FacultyMember; courses: string[] }>();

    for (const offering of offerings) {
      if (!offering.faculty?.id) continue;
      const existing = map.get(offering.faculty.id);
      const course = offering.course?.code
        ? `${offering.course.code} — ${offering.course.name ?? "Course"}`
        : "Course";
      if (existing) {
        if (!existing.courses.includes(course)) existing.courses.push(course);
      } else {
        map.set(offering.faculty.id, { member: offering.faculty, courses: [course] });
      }
    }

    return [...map.values()].sort((a, b) =>
      `${a.member.firstName} ${a.member.lastName}`.localeCompare(
        `${b.member.firstName} ${b.member.lastName}`
      )
    );
  }, [offerings]);

  return (
    <DashboardShell
      title="Department Faculty"
      subtitle="Faculty teaching within your authorised department scope"
      allowedRoles={["HOD"]}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            HOD workspace
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Faculty
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Faculty are derived from active course offerings returned for the
            authenticated HOD scope. No institution-wide HR or Accounts data is exposed here.
          </p>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </section>
        ) : loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
            Loading department faculty…
          </section>
        ) : faculty.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No faculty are currently attached to active course offerings in your department scope.
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {faculty.map(({ member, courses }) => (
              <article
                key={member.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="font-black text-slate-950">
                  {member.firstName} {member.lastName}
                </h2>
                {member.email ? (
                  <p className="mt-1 text-xs text-slate-500">{member.email}</p>
                ) : null}
                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Active teaching
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {courses.map((course) => (
                      <li key={course}>{course}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
