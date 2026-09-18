"use client";

import { useEffect, useMemo, useState } from "react";
import { getCourseOfferingRoster } from "@/lib/academicsApi";

type Offering = {
  id: string;
  course?: { code?: string; name?: string; credits?: number } | null;
  semester?: {
    number?: number;
    name?: string;
    program?: { name?: string; code?: string } | null;
    academicYear?: { name?: string } | null;
  } | null;
  section?: { name?: string } | null;
  faculty?: { firstName?: string; lastName?: string } | null;
  isActive?: boolean;
};

type RosterMember = {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
};

export default function CourseOfferingRoster({
  offering,
  onClose,
}: {
  offering: Offering;
  onClose: () => void;
}) {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getCourseOfferingRoster(offering.id);
        if (mounted) setRoster(data);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load roster.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [offering.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roster;
    return roster.filter((student) =>
      `${student.firstName} ${student.lastName} ${student.rollNumber ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [roster, search]);

  const courseName = offering.course?.code
    ? `${offering.course.code} — ${offering.course.name ?? "Course"}`
    : offering.course?.name ?? "Course Offering";

  const context = [
    offering.semester?.program?.code || offering.semester?.program?.name,
    offering.semester?.name || (offering.semester?.number ? `Semester ${offering.semester.number}` : undefined),
    offering.section?.name ? `Section ${offering.section.name}` : undefined,
    offering.semester?.academicYear?.name,
  ].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Student roster</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">{courseName}</h3>
            <p className="mt-1 text-sm text-slate-500">{context || "Academic offering"}</p>
            {offering.faculty && (
              <p className="mt-1 text-xs text-slate-400">
                Faculty: {offering.faculty.firstName} {offering.faculty.lastName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close roster"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student name or roll number…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 sm:max-w-md"
            />
            <div className="text-sm font-semibold text-slate-600">
              {filtered.length} of {roster.length} students
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-400">Loading live student roster…</div>
          ) : error ? (
            <div className="m-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              {roster.length === 0 ? "No active students are enrolled in this offering." : "No students match your search."}
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Roll number</th>
                  <th className="px-5 py-3">Student ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((student, index) => (
                  <tr key={student.studentId} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-400">{index + 1}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{student.rollNumber || "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{student.studentId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-400">
          This roster is read from the authoritative academic enrollment for this course offering. Attendance, marks and assignments use the same enrollment boundary.
        </div>
      </div>
    </div>
  );
}
