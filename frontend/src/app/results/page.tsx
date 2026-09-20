"use client";

import EntityPicker from "@/components/common/EntityPicker";
import { DirectoryOption } from "@/lib/directoryApi";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  AuthUser,
  getCurrentUser,
  isAuthenticated,
} from "@/lib/auth";
import {
  GradeScale,
  GradeSheet,
  Transcript,
  getCourseGradeSheet,
  getGradeScale,
  getMyTranscript,
  getStudentTranscript,
} from "@/lib/gradesApi";

type ViewState = "loading" | "ready" | "error";
type Tab = "transcript" | "gradesheet";

const pct = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;

export default function ResultsPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [lookupError, setLookupError] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");
  const [scale, setScale] = useState<GradeScale | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupStudent, setLookupStudent] =
    useState<DirectoryOption | null>(null);
  const [lookupOffering, setLookupOffering] =
    useState<DirectoryOption | null>(null);

  const [offeringId, setOfferingId] = useState("");
  const [sheet, setSheet] = useState<GradeSheet | null>(null);

  const isStudent = user?.roles.includes("STUDENT") ?? false;

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);

      const [scaleData] = await Promise.all([getGradeScale()]);
      setScale(scaleData);

      if (me.roles.includes("STUDENT")) {
        setTranscript(await getMyTranscript());
      } else {
        setTab("gradesheet");
      }

      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load results"
      );
      setState("error");
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [load, router]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError("");
    try {
      setTranscript(await getStudentTranscript(lookupId.trim()));
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : "Failed to load transcript"
      );
    }
  }

  async function handleSheet(e: React.FormEvent) {
    e.preventDefault();
    setLookupError("");
    try {
      setSheet(await getCourseGradeSheet(offeringId.trim()));
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : "Failed to load the grade sheet"
      );
    }
  }

  if (state === "loading") {
    return (
      <DashboardShell title="Results" subtitle="Grades, SGPA and CGPA">
        <div className="p-8 text-sm text-slate-500">Loading results…</div>
      </DashboardShell>
    );
  }

  if (state === "error") {
    return (
      <DashboardShell title="Results" subtitle="Grades, SGPA and CGPA">
        <div className="m-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Results"
      subtitle="Course grades, semester SGPA and cumulative CGPA"
    >
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <nav className="flex flex-wrap gap-2">
          {(
            [
              ["transcript", isStudent ? "My transcript" : "Student transcript"],
              ["gradesheet", "Class grade sheet"],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === key
                  ? "bg-slate-950 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {scale && (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Final marks combine internal assessment (
            {Math.round(scale.internalWeight * 100)}%) and examinations (
            {Math.round(scale.examWeight * 100)}%). Pass mark{" "}
            {scale.passPercentage}%. Scale:{" "}
            {scale.bands
              .map((band) => `${band.letter} ≥ ${band.min}% (${band.points})`)
              .join(" · ")}
          </p>
        )}

        {lookupError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {lookupError}
          </p>
        )}

        {tab === "transcript" && (
          <>
            {!isStudent && (
              <form
                onSubmit={handleLookup}
                className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex-1">
                  <EntityPicker
                    kind="student"
                    label="Student"
                    placeholder="Search by name, roll number or email"
                    value={lookupStudent}
                    onChange={(option) => {
                      setLookupStudent(option);
                      setLookupId(option?.id ?? "");
                    }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={!lookupId.trim()}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  Load transcript
                </button>
              </form>
            )}

            {transcript && (
              <>
                <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {(
                    [
                      [
                        "CGPA",
                        transcript.cgpa === null
                          ? "—"
                          : transcript.cgpa.toFixed(2),
                      ],
                      [
                        "Percentage",
                        transcript.percentageEquivalent === null
                          ? "—"
                          : `${transcript.percentageEquivalent.toFixed(1)}%`,
                      ],
                      ["Credits attempted", String(transcript.totalCredits)],
                      ["Credits earned", String(transcript.creditsEarned)],
                    ] as Array<[string, string]>
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-950">
                        {value}
                      </p>
                    </div>
                  ))}
                </section>

                {transcript.semesters.map((semester) => (
                  <section
                    key={semester.semesterId}
                    className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {semester.semesterName} · {semester.academicYearName}
                      </h2>
                      <p className="text-sm font-semibold text-slate-600">
                        SGPA{" "}
                        {semester.sgpa === null
                          ? "—"
                          : semester.sgpa.toFixed(2)}{" "}
                        · {semester.creditsEarned}/{semester.credits} credits
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="py-2">Course</th>
                            <th>Credits</th>
                            <th>Internal</th>
                            <th>Exam</th>
                            <th>Final</th>
                            <th>Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {semester.courses.map((course) => (
                            <tr key={course.courseOfferingId}>
                              <td className="py-3 font-semibold text-slate-900">
                                {course.courseCode} — {course.courseName}
                              </td>
                              <td className="text-slate-600">
                                {course.credits}
                              </td>
                              <td className="text-slate-600">
                                {pct(course.internalPercentage)}
                              </td>
                              <td className="text-slate-600">
                                {pct(course.examPercentage)}
                              </td>
                              <td className="text-slate-600">
                                {pct(course.percentage)}
                              </td>
                              <td>
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-bold ${
                                    course.passed === null
                                      ? "bg-slate-100 text-slate-600"
                                      : course.passed
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {course.letter ?? "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}

                {transcript.semesters.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                    No graded courses recorded yet.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {tab === "gradesheet" && (
          <>
            <form
              onSubmit={handleSheet}
              className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex-1">
                <EntityPicker
                  kind="courseOffering"
                  label="Course offering"
                  placeholder="Search by course code or name"
                  value={lookupOffering}
                  onChange={(option) => {
                    setLookupOffering(option);
                    setOfferingId(option?.id ?? "");
                  }}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!offeringId.trim()}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Load grade sheet
              </button>
            </form>

            {sheet && (
              <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    {sheet.offering.course.code} — {sheet.offering.course.name}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {sheet.offering.semester.name} · Section{" "}
                    {sheet.offering.section.name} · Class average{" "}
                    {pct(sheet.classAverage)}
                  </p>
                </div>

                <p className="text-sm text-slate-500">
                  {Object.entries(sheet.distribution)
                    .map(([letter, count]) => `${letter}: ${count}`)
                    .join(" · ") || "No grades computed yet"}
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-2">Roll</th>
                        <th>Student</th>
                        <th>Internal</th>
                        <th>Exam</th>
                        <th>Final</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sheet.rows.map((row) => (
                        <tr key={row.studentId}>
                          <td className="py-3 text-slate-600">
                            {row.rollNumber || "—"}
                          </td>
                          <td className="font-semibold text-slate-900">
                            {row.name}
                            <span className="block text-xs font-normal text-slate-400">
                              {row.email}
                            </span>
                          </td>
                          <td className="text-slate-600">
                            {pct(row.internalPercentage)}
                          </td>
                          <td className="text-slate-600">
                            {pct(row.examPercentage)}
                          </td>
                          <td className="text-slate-600">
                            {pct(row.percentage)}
                          </td>
                          <td>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-bold ${
                                row.passed === null
                                  ? "bg-slate-100 text-slate-600"
                                  : row.passed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {row.letter ?? "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {sheet.rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center text-slate-500"
                          >
                            No students are attached to this offering.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </DashboardShell>
  );
}
