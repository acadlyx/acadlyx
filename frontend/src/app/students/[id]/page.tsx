"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import {
  StudentEnrollmentRecord,
  StudentRecord,
  getStudent,
  getStudentEnrollments,
} from "@/lib/studentProfileApi";
import { MovementRequest, getStudentMovementHistory } from "@/lib/movementApi";

type ViewState = "loading" | "ready" | "error";

const day = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : "—";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const studentId = params?.id;

  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [enrollments, setEnrollments] = useState<StudentEnrollmentRecord[]>([]);
  const [movements, setMovements] = useState<MovementRequest[]>([]);

  const load = useCallback(async () => {
    if (!studentId) return;
    try {
      const [record, enrollmentList] = await Promise.all([
        getStudent(studentId),
        getStudentEnrollments(studentId).catch(() => []),
      ]);
      setStudent(record);
      setEnrollments(enrollmentList);

      /* Movement history needs the promotions feature and permission;
         its absence must not break the profile. */
      try {
        const history = await getStudentMovementHistory(studentId);
        setMovements(history.requests);
      } catch {
        setMovements([]);
      }

      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load the student record"
      );
      setState("error");
    }
  }, [studentId, router]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [load, router]);

  if (state === "loading") {
    return (
      <DashboardShell title="Student Profile" subtitle="Academic record">
        <div className="p-8 text-sm text-slate-500">Loading student…</div>
      </DashboardShell>
    );
  }

  if (state === "error" || !student) {
    return (
      <DashboardShell title="Student Profile" subtitle="Academic record">
        <div className="m-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage || "Student not found"}
        </div>
      </DashboardShell>
    );
  }

  const profile = student.profile;
  const current = student.currentEnrollment ?? enrollments[0] ?? null;

  return (
    <DashboardShell
      title={`${student.firstName} ${student.lastName}`}
      subtitle="Student master record"
    >
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-950">
                {student.firstName} {student.lastName}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {student.email}
                {student.phone ? ` · ${student.phone}` : ""}
              </p>
              {profile && (
                <p className="mt-1 text-sm font-semibold text-indigo-600">
                  Admission no. {profile.admissionNumber}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  student.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {student.isActive ? "Active account" : "Inactive account"}
              </span>
              {profile && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {profile.status}
                </span>
              )}
            </div>
          </div>

          {current && (
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {current.program.name} ({current.program.code}) ·{" "}
              {current.academicYear.name}
              {current.semester ? ` · ${current.semester.name}` : ""}
              {current.section ? ` · Section ${current.section.name}` : ""}
              {current.rollNumber ? ` · Roll ${current.rollNumber}` : ""}
            </p>
          )}
        </section>

        {profile && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Personal details
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Date of birth" value={day(profile.dateOfBirth)} />
              <Field label="Gender" value={profile.gender} />
              <Field label="Blood group" value={profile.bloodGroup} />
              <Field label="Nationality" value={profile.nationality} />
              <Field label="Admission date" value={day(profile.admissionDate)} />
              <Field
                label="Address"
                value={[
                  profile.address,
                  profile.city,
                  profile.state,
                  profile.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Field label="Guardian" value={profile.guardianName} />
              <Field label="Guardian phone" value={profile.guardianPhone} />
              <Field label="Guardian email" value={profile.guardianEmail} />
              <Field
                label="Emergency contact"
                value={
                  profile.emergencyContactName
                    ? `${profile.emergencyContactName} (${profile.emergencyContactPhone ?? "—"})`
                    : null
                }
              />
            </dl>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Enrolment history
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Academic year</th>
                  <th>Programme</th>
                  <th>Semester</th>
                  <th>Section</th>
                  <th>Roll no.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrollments.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 font-semibold text-slate-900">
                      {row.academicYear.name}
                      {row.academicYear.isCurrent && (
                        <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          Current
                        </span>
                      )}
                    </td>
                    <td className="text-slate-600">{row.program.name}</td>
                    <td className="text-slate-600">
                      {row.semester?.name || "—"}
                    </td>
                    <td className="text-slate-600">{row.section?.name || "—"}</td>
                    <td className="text-slate-600">{row.rollNumber || "—"}</td>
                    <td className="text-slate-600">{row.status}</td>
                  </tr>
                ))}
                {enrollments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No enrolment records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {movements.length > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Movement history
            </h2>
            <ul className="space-y-3">
              {movements.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm"
                >
                  <p className="font-semibold text-slate-900">
                    {row.requestType.replace("_", " ")} — {row.status}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {[
                      row.targetProgram?.name,
                      row.targetAcademicYear?.name,
                      row.targetSection?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No target recorded"}
                    {row.decidedAt ? ` · decided ${day(row.decidedAt)}` : ""}
                  </p>
                  {row.decisionNote && (
                    <p className="mt-1 text-slate-500">{row.decisionNote}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </DashboardShell>
  );
}
