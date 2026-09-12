"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import { getAssignment, submitMyAssignment } from "@/lib/academicsApi";
import { AssignmentData } from "@/types/academics";

type ViewState = "loading" | "ready" | "error";
type SubmitState = "idle" | "saving" | "saved" | "error";

export default function StudentAssignmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<ViewState>("loading");
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [content, setContent] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    let isMounted = true;
    getAssignment(params.id)
      .then((a) => {
        if (!isMounted) return;
        setAssignment(a);
        setContent(a.mySubmission?.content ?? "");
        setState("ready");
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setErrorMessage(err.message);
        setState("error");
      });
    return () => {
      isMounted = false;
    };
  }, [params.id, router]);

  async function handleSubmit() {
    if (!assignment || content.trim().length === 0) return;
    setSubmitState("saving");
    try {
      await submitMyAssignment(assignment.id, content);
      const refreshed = await getAssignment(assignment.id);
      setAssignment(refreshed);
      setSubmitState("saved");
      setSubmitMessage("Submitted.");
    } catch (err) {
      setSubmitState("error");
      setSubmitMessage(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading assignment…</p>
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

  const submission = assignment.mySubmission;
  const isReviewed = submission?.status === "REVIEWED";

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Link href="/student/assignments" className="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Back to assignments
        </Link>

        <div className="mt-3 mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            {assignment.courseOffering.course.code} — {assignment.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Due {new Date(assignment.dueDate).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            · {assignment.maxMarks} marks
          </p>
        </div>

        {assignment.description && (
          <DashboardCard title="Description" className="mb-4">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{assignment.description}</p>
          </DashboardCard>
        )}

        {isReviewed && (
          <DashboardCard title="Feedback" className="mb-4">
            <div className="flex items-center gap-2">
              <StatusBadge tone="success">Reviewed</StatusBadge>
              <span className="text-sm font-semibold text-slate-900">
                {submission?.marksAwarded}/{assignment.maxMarks}
              </span>
            </div>
            {submission?.feedback && (
              <p className="mt-2 text-sm text-slate-600">{submission.feedback}</p>
            )}
          </DashboardCard>
        )}

        <DashboardCard title={submission ? "Your Submission" : "Submit Your Work"}>
          {submission && (
            <div className="mb-3">
              <StatusBadge tone={submission.status === "LATE" ? "warning" : "success"}>
                {submission.status === "LATE" ? "Submitted late" : "Submitted"}
              </StatusBadge>
            </div>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Type or paste your submission…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {submission ? "Resubmitting replaces your previous submission." : ""}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitState === "saving" || content.trim().length === 0}
              className="rounded-lg bg-acadlyx-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submission ? "Resubmit" : "Submit"}
            </button>
          </div>
          {submitMessage && (
            <p className={`mt-2 text-sm ${submitState === "error" ? "text-red-600" : "text-emerald-600"}`}>
              {submitMessage}
            </p>
          )}
        </DashboardCard>
      </div>
    </main>
  );
}
