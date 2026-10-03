"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch, isAuthenticated } from "@/lib/auth";
import { decideRegistration } from "@/lib/registrationApi";
import { useWorkspaceContext } from "@/lib/workspaceContext";
import { ContextBreadcrumbs } from "@/components/dashboard/ContextBreadcrumbs";

type ApiEnvelope<T> = { success: boolean; data: T };
type Paged<T> = ApiEnvelope<T[]> & { meta?: { total?: number } };

type Semester = {
  id: string;
  name: string;
  number: number;
  program?: { id: string; name: string; code: string };
  academicYear?: { id: string; name: string };
};

type Section = {
  id: string;
  name: string;
  semesterId: string;
};

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profile?: { admissionNumber?: string; status?: string } | null;
  currentEnrollment?: {
    rollNumber?: string | null;
    program?: { id: string; name: string; code: string };
    semester?: { id: string; number: number; name: string } | null;
    section?: { id: string; name: string } | null;
  } | null;
};

type Offering = {
  id: string;
  capacity: number | null;
  registrationOpen: boolean;
  isElective: boolean;
  course: { id: string; code: string; name: string; credits: number };
  semester: { id: string; name: string };
  section: { id: string; name: string; capacity: number | null };
  faculty: { id: string; firstName: string; lastName: string } | null;
};

type Registration = {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "DROPPED";
  remarks: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; email: string };
  courseOffering: {
    id: string;
    course: { code: string; name: string; credits: number };
    semester: { id: string; name: string };
    section: { id: string; name: string };
    faculty: { firstName: string; lastName: string } | null;
  };
};

type Tab = "students" | "registrations";

async function getData<T>(path: string): Promise<T> {
  const response = await authedFetch<ApiEnvelope<T> & { meta?: unknown }>(path);
  return response.data;
}

export default function HODDashboardPage() {
  const searchParams = useSearchParams();
  const activeTab: Tab =
    searchParams.get("tab") === "registrations"
      ? "registrations"
      : "students";

  const contextParams = useMemo(
    () => ({
      departmentId: searchParams.get("departmentId") || undefined,
      programId: searchParams.get("programId") || undefined,
      academicYearId: searchParams.get("academicYearId") || undefined,
      semesterId: searchParams.get("semesterId") || undefined,
      sectionId: searchParams.get("sectionId") || undefined,
    }),
    [searchParams]
  );

  const workspaceContext = useWorkspaceContext(contextParams);

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  const [semesterId, setSemesterId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedOfferings, setSelectedOfferings] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadBase = useCallback(async () => {
    const semesterResponse = await authedFetch<Paged<Semester>>(
      "/semesters?pageSize=100"
    );
    setSemesters(semesterResponse.data ?? []);

    if (!semesterId && semesterResponse.data?.length) {
      const current =
        semesterResponse.data.find(
          (semester) => semester.academicYear?.id
        ) ?? semesterResponse.data[0];
      setSemesterId(current.id);
    }
  }, [semesterId]);

  const loadStudents = useCallback(async () => {
    const query = new URLSearchParams({
      pageSize: "100",
      status: "ACTIVE",
    });

    if (semesterId) query.set("semesterId", semesterId);
    if (sectionId) query.set("sectionId", sectionId);
    if (search.trim()) query.set("search", search.trim());

    const response = await authedFetch<Paged<Student>>(
      `/students?${query.toString()}`
    );
    setStudents(response.data ?? []);
  }, [semesterId, sectionId, search]);

  const loadSectionsAndOfferings = useCallback(async () => {
    if (!semesterId) {
      setSections([]);
      setOfferings([]);
      return;
    }

    const [sectionResponse, offeringResponse] = await Promise.all([
      authedFetch<Paged<Section>>(
        `/sections?semesterId=${encodeURIComponent(semesterId)}&pageSize=100`
      ),
      authedFetch<Paged<Offering>>(
        `/course-offerings?semesterId=${encodeURIComponent(
          semesterId
        )}&${sectionId ? `sectionId=${encodeURIComponent(sectionId)}&` : ""}pageSize=100&isActive=true`
      ),
    ]);

    setSections(sectionResponse.data ?? []);
    setOfferings(offeringResponse.data ?? []);

    if (
      sectionId &&
      !(sectionResponse.data ?? []).some((section) => section.id === sectionId)
    ) {
      setSectionId("");
    }
  }, [semesterId, sectionId]);

  const loadRegistrations = useCallback(async () => {
    const query = new URLSearchParams({
      pageSize: "100",
      status: "REQUESTED",
    });

    if (semesterId) query.set("semesterId", semesterId);
    if (search.trim()) query.set("search", search.trim());

    const response = await authedFetch<Paged<Registration> & {
      summary?: Record<string, number>;
    }>(`/registrations?${query.toString()}`);

    setRegistrations(response.data ?? []);
  }, [semesterId, search]);

  useEffect(() => {
    if (!isAuthenticated()) return;

    let mounted = true;
    setLoading(true);
    setError("");

    loadBase()
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof AuthRequiredError
              ? "Your session has expired. Please sign in again."
              : err instanceof Error
                ? err.message
                : "Unable to load HOD academic data."
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [loadBase]);

  useEffect(() => {
    if (!semesterId) return;
    Promise.all([
      loadSectionsAndOfferings(),
      loadStudents(),
      loadRegistrations(),
    ]).catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load HOD academic data."
      );
    });
  }, [
    semesterId,
    sectionId,
    search,
    loadSectionsAndOfferings,
    loadStudents,
    loadRegistrations,
  ]);

  const filteredOfferings = useMemo(() => {
    if (!sectionId) return offerings;
    return offerings.filter((offering) => offering.section.id === sectionId);
  }, [offerings, sectionId]);

  const toggleStudent = (id: string) => {
    setSelectedStudents((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  };

  const toggleOffering = (id: string) => {
    setSelectedOfferings((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  };

  const assignCourses = async () => {
    if (!selectedStudents.length || !selectedOfferings.length) {
      setError("Select at least one student and one course.");
      return;
    }

    setWorking(true);
    setError("");

    try {
      await authedFetch<ApiEnvelope<unknown>>("/registrations/bulk-assign", {
        method: "POST",
        body: JSON.stringify({
          studentIds: selectedStudents,
          courseOfferingIds: selectedOfferings,
        }),
      });

      setSelectedStudents([]);
      setSelectedOfferings([]);
      await Promise.all([loadStudents(), loadRegistrations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Course assignment failed.");
    } finally {
      setWorking(false);
    }
  };

  const approve = async (registration: Registration) => {
    setWorking(true);
    setError("");

    try {
      await decideRegistration(registration.id, "APPROVED");
      await loadRegistrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setWorking(false);
    }
  };

  const reject = async (registration: Registration) => {
    const remarks = window.prompt("Reason for rejecting this registration:");
    if (!remarks?.trim()) return;

    setWorking(true);
    setError("");

    try {
      await decideRegistration(registration.id, "REJECTED", remarks.trim());
      await loadRegistrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setWorking(false);
    }
  };

  const selectedStudentSet = new Set(selectedStudents);
  const selectedOfferingSet = new Set(selectedOfferings);

  return (
    <DashboardShell
      title="HOD Academic Operations"
      subtitle="Students, course assignment and course-registration approval"
      allowedRoles={["HOD"]}
    >
      <div className="space-y-6">
        {workspaceContext.data?.breadcrumbs?.length ? (
          <ContextBreadcrumbs items={workspaceContext.data.breadcrumbs} />
        ) : null}

        {workspaceContext.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Institutional context could not be resolved. The server will continue to enforce HOD scope on every request.
          </div>
        ) : null}
        <section className="rounded-3xl border border-[#dfd4c4] bg-[#f3eadf] p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Department academic control
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Student course lifecycle
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Filter your department students by semester and section, assign
                courses in bulk, and approve student registration requests.
                Only approved registrations enter academic rosters.
              </p>
            </div>

            <div className="flex rounded-2xl border border-[#d8c9b7] bg-white p-1">
              <a
                href="/hod"
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  activeTab === "students"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600"
                }`}
              >
                Students & assignment
              </a>
              <a
                href="/hod?tab=registrations"
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  activeTab === "registrations"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600"
                }`}
              >
                Registration approval
              </a>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#dfd4c4] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Students
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {students.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#dfd4c4] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Courses
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {filteredOfferings.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#dfd4c4] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pending approvals
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {registrations.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#dfd4c4] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Selected
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {selectedStudents.length} / {selectedOfferings.length}
            </p>
          </div>
        </section>

        {activeTab === "students" ? (
          <>
            <section className="rounded-2xl border border-[#dfd4c4] bg-white p-5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  value={semesterId}
                  onChange={(event) => {
                    setSemesterId(event.target.value);
                    setSectionId("");
                    setSelectedStudents([]);
                    setSelectedOfferings([]);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none"
                >
                  <option value="">Select semester</option>
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.program?.code ? `${semester.program.code} — ` : ""}
                      {semester.name}
                      {semester.academicYear?.name
                        ? ` — ${semester.academicYear.name}`
                        : ""}
                    </option>
                  ))}
                </select>

                <select
                  value={sectionId}
                  onChange={(event) => {
                    setSectionId(event.target.value);
                    setSelectedStudents([]);
                    setSelectedOfferings([]);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none"
                >
                  <option value="">All sections</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search student name, email or admission no."
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none"
                />
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
              <section className="rounded-2xl border border-[#dfd4c4] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                      Student directory
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-950">
                      Select students
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedStudents(
                        selectedStudents.length === students.length
                          ? []
                          : students.map((student) => student.id)
                      )
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {selectedStudents.length === students.length
                      ? "Clear all"
                      : "Select all"}
                  </button>
                </div>

                <div className="max-h-[560px] divide-y divide-slate-100 overflow-auto">
                  {loading ? (
                    <p className="p-6 text-sm text-slate-500">Loading students…</p>
                  ) : students.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">
                      No active students match this semester/section.
                    </p>
                  ) : (
                    students.map((student) => (
                      <label
                        key={student.id}
                        className="flex cursor-pointer items-center gap-3 p-4 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentSet.has(student.id)}
                          onChange={() => toggleStudent(student.id)}
                          className="h-4 w-4"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {student.firstName} {student.lastName}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {student.profile?.admissionNumber || "No admission no."}
                            {student.currentEnrollment?.section?.name
                              ? ` · Section ${student.currentEnrollment.section.name}`
                              : ""}
                            {student.currentEnrollment?.rollNumber
                              ? ` · Roll ${student.currentEnrollment.rollNumber}`
                              : ""}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[#dfd4c4] bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Course catalogue
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    Assign courses
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Selected courses are assigned and approved immediately by
                    the HOD. Students then become eligible for academic rosters.
                  </p>
                </div>

                <div className="max-h-[480px] divide-y divide-slate-100 overflow-auto">
                  {filteredOfferings.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">
                      No course offerings match the selected semester/section.
                    </p>
                  ) : (
                    filteredOfferings.map((offering) => (
                      <label
                        key={offering.id}
                        className="flex cursor-pointer items-start gap-3 p-4 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOfferingSet.has(offering.id)}
                          onChange={() => toggleOffering(offering.id)}
                          className="mt-1 h-4 w-4"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {offering.course.code} — {offering.course.name}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {offering.course.credits} credits · Section{" "}
                            {offering.section.name}
                            {offering.isElective ? " · Elective" : ""}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            Faculty:{" "}
                            {offering.faculty
                              ? `${offering.faculty.firstName} ${offering.faculty.lastName}`
                              : "Unassigned"}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-100 p-5">
                  <button
                    type="button"
                    disabled={
                      working ||
                      !selectedStudents.length ||
                      !selectedOfferings.length
                    }
                    onClick={assignCourses}
                    className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {working
                      ? "Assigning…"
                      : `Assign ${selectedOfferings.length} course(s) to ${selectedStudents.length} student(s)`}
                  </button>
                </div>
              </section>
            </div>
          </>
        ) : (
          <section className="rounded-2xl border border-[#dfd4c4] bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Registration workflow
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    Pending course-registration approvals
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    No pending registration is considered academically cleared
                    until the HOD approves it.
                  </p>
                </div>

                <select
                  value={semesterId}
                  onChange={(event) => setSemesterId(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                >
                  <option value="">All semesters</option>
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                      {semester.academicYear?.name
                        ? ` — ${semester.academicYear.name}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {registrations.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  No pending course-registration requests are currently in your
                  department scope.
                </p>
              ) : (
                registrations.map((registration) => (
                  <article
                    key={registration.id}
                    className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-950">
                        {registration.student.firstName}{" "}
                        {registration.student.lastName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {registration.courseOffering.course.code} —{" "}
                        {registration.courseOffering.course.name}
                        {" · "}
                        {registration.courseOffering.course.credits} credits
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {registration.courseOffering.semester.name} · Section{" "}
                        {registration.courseOffering.section.name}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => approve(registration)}
                        className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => reject(registration)}
                        className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700 disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
