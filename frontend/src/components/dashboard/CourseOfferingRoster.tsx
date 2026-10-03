"use client";

import { useEffect, useMemo, useState } from "react";
import { getCourseOfferingRoster } from "@/lib/academicsApi";
import { DetailDrawer } from "@/components/ui/DetailDrawer";

type Offering = {
  id: string;
  course?: { code?: string; name?: string; credits?: number } | null;
  semester?: { number?: number; name?: string; program?: { name?: string; code?: string } | null; academicYear?: { name?: string } | null } | null;
  section?: { name?: string } | null;
  faculty?: { firstName?: string; lastName?: string } | null;
  isActive?: boolean;
};

type RosterMember = { studentId: string; firstName: string; lastName: string; rollNumber: string | null };

export default function CourseOfferingRoster({ offering, onClose }: { offering: Offering; onClose: () => void }) {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError("");
      try { const data = await getCourseOfferingRoster(offering.id); if (mounted) setRoster(data); }
      catch (err) { if (mounted) setError(err instanceof Error ? err.message : "Unable to load roster."); }
      finally { if (mounted) setLoading(false); }
    }
    void load();
    return (
    <DetailDrawer
      eyebrow="Student roster"
      title={courseName}
      subtitle={context || "Academic offering"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Close
          </button>
        </div>
      }
    >
      {offering.faculty ? (
        <p className="text-xs font-semibold text-slate-500">
          Faculty: {offering.faculty.firstName} {offering.faculty.lastName}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search student name or roll number…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
        />
        <div className="shrink-0 text-sm font-semibold text-slate-600">
          {filtered.length} of {roster.length} students
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">
          Loading live student roster…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">
          {roster.length === 0
            ? "No active students are enrolled in this offering."
            : "No students match your search."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Student</th>
                <th className="px-3 py-2.5">Roll number</th>
                <th className="px-3 py-2.5">Student ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((student, index) => (
                <tr key={student.studentId} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-slate-400">{index + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    {student.firstName} {student.lastName}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {student.rollNumber || "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-400">
                    {student.studentId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-400">
        This roster is read from the authoritative academic enrollment for this course offering.
        Attendance, marks and assignments use the same enrollment boundary.
      </p>
    </DetailDrawer>
  );
}
