"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import {
  getAssignment,
  getAssignmentSubmissions,
  reviewSubmission,
  updateAssignment,
} from "@/lib/academicsApi";
import { AssignmentData, RosterSubmissionRow } from "@/types/academics";

type ViewState = "loading" | "ready" | "error";

function ReviewRow({
  assignmentId,
  row,
  maxMarks,
  onReviewed,
}: {
  assignmentId: string;
  row: RosterSubmissionRow;
  maxMarks: number;
  onReviewed: () => void;
}) {
  const [marks, setMarks] = useState(row.submission?.marksAwarded ?? 0);
  const [feedback, setFeedback] = useState(row.submission?.feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleReview() {
    setSaving(true);
    setError("");
    try {
      await reviewSubmission(assignmentId, row.studentId, { marksAwarded: marks, feedback });
      onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">
            {row.firstName} {row.lastName}
          </p>
          <p className="text-xs text-slate-400">{row.rollNumber ?? "—"}</p>
        </div>
        {!row.submission && <StatusBadge tone="danger">Not submitted</StatusBadge>}
        {row.submission?.status === "SUBMITTED" && <StatusBadge tone="warning">To review</StatusBadge>}
        {row.submission?.status === "LATE" && <StatusBadge tone="warning">Late — to review</StatusBadge>}
        {row.submission?.status === "REVIEWED" && <StatusBadge tone="success">Reviewed</StatusBadge>}
      </div>

      {row.submission && (
        <div className="mt-2 rounded-lg bg-slate-50 p-3">
          {row.submission.content && (
            <p className="mb-2 whitespace-pre-wrap text-xs text-slate-600">{row.submission.content}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              max={maxMarks}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <span className="text-xs text-slate-400">/ {maxMarks}</span>
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Feedback (optional)"
              className="flex-1 min-w-[160px] rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={handleReview}
              disabled={saving}
              className="rounded-lg bg-acadlyx-primary px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </li>
  );
}

export default function FacultyAssignmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<ViewState>("loading");
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [rows, setRows] = useState<RosterSubmissionRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function load() {
    const [a, r] = await Promise.all([
      getAssignment(params.id),
      getAssignmentSubmissions(params.id),
    ]);
    setAssignment(a);
    setRows(r);
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load()
      .then(() => setState("ready"))
      .catch((err: Error) => {
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setErrorMessage(err.message);
        setState("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, router]);

  async function togglePublish() {
    if (!assignment) return;
    await updateAssignment(assignment.id, {
      status: assignment.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
    });
    await load();
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  if (state === "error" || !assignment) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-red-600">Couldn&apos;t load assignment</p>
        <p className="text-sm text-slate-500">{errorMessage}</p>
      </main>
    );
  }

  const submittedCount = rows.filter((r) => r.submission).length;

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Link href="/faculty/assignments" className="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Back to assignments
        </Link>

        <div className="mt-3 mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {assignment.courseOffering.course.code} — {assignment.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {submittedCount}/{rows.length} submitted · {assignment.maxMarks} marks
            </p>
          </div>
          <button
            type="button"
            onClick={togglePublish}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {assignment.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          </button>
        </div>

        <DashboardCard title="Submissions">
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <ReviewRow
                key={row.studentId}
                assignmentId={assignment.id}
                row={row}
                maxMarks={assignment.maxMarks}
                onReviewed={load}
              />
            ))}
          </ul>
        </DashboardCard>
      </div>
    </main>
  );
}
