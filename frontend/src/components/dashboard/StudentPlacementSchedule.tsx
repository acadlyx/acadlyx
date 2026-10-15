"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";

type ScheduledDrive = {
  id: string;
  title: string;
  status: string;
  driveDate: string | null;
  applicationDeadline: string | null;
  company: { id: string; name: string };
};
type ScheduledInterview = {
  id: string;
  roundType: string;
  roundNumber: number;
  startsAt: string;
  endsAt: string | null;
  venue: string | null;
  onlineLink: string | null;
  status: string;
  drive: { id: string; title: string; company: { id: string; name: string } };
};
type ScheduledAssessment = {
  id: string;
  title: string;
  mode: string;
  scheduledAt: string;
  durationMinutes: number | null;
  testLink: string | null;
  instructions: string | null;
  drive: { id: string; title: string; company: { id: string; name: string } };
  participants: Array<{ attendanceStatus: string; resultStatus: string; score: number | null }>;
};

function when(value: string | null | undefined) {
  if (!value) return "Date to be announced";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date to be announced" : date.toLocaleString("en-IN");
}

export function StudentPlacementSchedule() {
  const router = useRouter();
  const [drives, setDrives] = useState<ScheduledDrive[]>([]);
  const [interviews, setInterviews] = useState<ScheduledInterview[]>([]);
  const [assessments, setAssessments] = useState<ScheduledAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [driveResult, interviewResult, assessmentResult] = await Promise.allSettled([
      authedFetch<{ data: ScheduledDrive[] }>("/placements/drives"),
      authedFetch<{ data: ScheduledInterview[] }>("/placements/interviews"),
      authedFetch<{ data: ScheduledAssessment[] }>("/placements/tests"),
    ]);

    const authError = [driveResult, interviewResult, assessmentResult].find(
      (result) => result.status === "rejected" && result.reason instanceof AuthRequiredError,
    );
    if (authError) {
      router.replace("/login");
      setLoading(false);
      return;
    }

    if (driveResult.status === "fulfilled") setDrives(driveResult.value.data || []);
    if (interviewResult.status === "fulfilled") setInterviews(interviewResult.value.data || []);
    if (assessmentResult.status === "fulfilled") setAssessments(assessmentResult.value.data || []);

    if ([driveResult, interviewResult, assessmentResult].every((result) => result.status === "rejected")) {
      const failed = [driveResult, interviewResult, assessmentResult].find((result) => result.status === "rejected");
      const reason = failed && failed.status === "rejected" ? failed.reason : null;
      setError(reason instanceof HttpRequestError ? reason.message : "Placement schedules could not be loaded. Please retry.");
    } else if ([driveResult, interviewResult, assessmentResult].some((result) => result.status === "rejected")) {
      setError("Some placement schedules could not be refreshed. Use Refresh to try again.");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const hasItems = drives.length > 0 || interviews.length > 0 || assessments.length > 0;

  return (
    <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Career & recruitment</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Placement schedule</h2>
          <p className="mt-1 text-sm text-slate-600">Published drives, assigned interviews and assessments for you.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
          <Link href="/student/placements" className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Open placements</Link>
        </div>
      </div>

      {error && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="font-black text-slate-900">Placement drives</h3><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-800">{drives.length}</span></div>
          <div className="mt-3 space-y-3">
            {drives.slice(0, 4).map((drive) => <article key={drive.id} className="border-t border-slate-100 pt-3">
              <p className="font-bold text-slate-900">{drive.title}</p><p className="text-sm text-slate-600">{drive.company.name}</p>
              <p className="mt-1 text-xs text-slate-500">{when(drive.driveDate || drive.applicationDeadline)}</p>
              <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{drive.status.replaceAll("_", " ")}</span>
            </article>)}
            {!loading && drives.length === 0 && <p className="border-t border-slate-100 pt-3 text-sm text-slate-500">No published drives are available for display yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="font-black text-slate-900">Interviews</h3><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-800">{interviews.length}</span></div>
          <div className="mt-3 space-y-3">
            {interviews.slice(0, 4).map((interview) => <article key={interview.id} className="border-t border-slate-100 pt-3">
              <p className="font-bold text-slate-900">{interview.roundType} · Round {interview.roundNumber}</p><p className="text-sm text-slate-600">{interview.drive.company.name} — {interview.drive.title}</p>
              <p className="mt-1 text-xs text-slate-500">{when(interview.startsAt)}</p>
              {interview.venue && <p className="mt-1 text-xs text-slate-600">Venue: {interview.venue}</p>}
              {interview.onlineLink && <a className="mt-2 inline-flex text-xs font-bold text-blue-700 underline" href={interview.onlineLink} target="_blank" rel="noreferrer">Join interview</a>}
            </article>)}
            {!loading && interviews.length === 0 && <p className="border-t border-slate-100 pt-3 text-sm text-slate-500">No interviews assigned to you yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="font-black text-slate-900">Assessments</h3><span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-black text-violet-800">{assessments.length}</span></div>
          <div className="mt-3 space-y-3">
            {assessments.slice(0, 4).map((assessment) => <article key={assessment.id} className="border-t border-slate-100 pt-3">
              <p className="font-bold text-slate-900">{assessment.title}</p><p className="text-sm text-slate-600">{assessment.drive.company.name} — {assessment.drive.title}</p>
              <p className="mt-1 text-xs text-slate-500">{when(assessment.scheduledAt)} · {assessment.mode}{assessment.durationMinutes ? ` · ${assessment.durationMinutes} min` : ""}</p>
              <p className="mt-1 text-xs text-slate-600">Status: {assessment.participants[0]?.resultStatus || "SCHEDULED"}</p>
              {assessment.testLink && <a className="mt-2 inline-flex text-xs font-bold text-violet-700 underline" href={assessment.testLink} target="_blank" rel="noreferrer">Open assessment</a>}
            </article>)}
            {!loading && assessments.length === 0 && <p className="border-t border-slate-100 pt-3 text-sm text-slate-500">No assessments assigned to you yet.</p>}
          </div>
        </div>
      </div>
      {!loading && !hasItems && <p className="mt-4 text-xs text-slate-500">When a drive is published or a recruiter schedule is assigned to your placement application, it will appear here.</p>}
    </section>
  );
}
