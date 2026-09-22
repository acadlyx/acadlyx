"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

import {
  AuthRequiredError,
} from "@/lib/auth";

import {
  getAssignment,
  submitMyAssignment,
} from "@/lib/academicsApi";

import {
  AssignmentData,
} from "@/types/academics";

type ViewState =
  | "loading"
  | "ready"
  | "error";

type SubmitState =
  | "idle"
  | "saving"
  | "saved"
  | "error";

function LoadingState() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-[500px] max-w-full animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="h-36 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />

      <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
    </div>
  );
}

export default function StudentAssignmentDetailPage() {
  const router = useRouter();

  const params =
    useParams<{ id: string }>();

  const [state, setState] =
    useState<ViewState>("loading");

  const [assignment, setAssignment] =
    useState<AssignmentData | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [content, setContent] =
    useState("");

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");

  const [submitMessage, setSubmitMessage] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    getAssignment(params.id)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setAssignment(data);
        setContent(
          data.mySubmission?.content ?? "",
        );
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        if (
          error instanceof AuthRequiredError
        ) {
          router.replace("/login");
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load assignment.",
        );

        setState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [params.id, router]);

  async function handleSubmit() {
    if (
      !assignment ||
      content.trim().length === 0
    ) {
      return;
    }

    setSubmitState("saving");
    setSubmitMessage("");

    try {
      await submitMyAssignment(
        assignment.id,
        content,
      );

      const refreshed =
        await getAssignment(
          assignment.id,
        );

      setAssignment(refreshed);

      setContent(
        refreshed.mySubmission?.content ??
          content,
      );

      setSubmitState("saved");
      setSubmitMessage(
        "Your submission has been saved.",
      );
    } catch (error: unknown) {
      if (
        error instanceof AuthRequiredError
      ) {
        router.replace("/login");
        return;
      }

      setSubmitState("error");
      setSubmitMessage(
        error instanceof Error
          ? error.message
          : "Failed to submit assignment.",
      );
    }
  }

  return (
    <DashboardShell
      title="Assignment"
      subtitle="View assignment details and submit your work"
      allowedRoles={["STUDENT"]}
    >
      {state === "loading" ? (
        <LoadingState />
      ) : state === "error" ||
        !assignment ? (
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-900">
              Couldn&apos;t load assignment
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
              >
                Retry
              </button>

              <Link
                href="/student/assignments"
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Back to assignments
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <Link
            href="/student/assignments"
            className="inline-flex items-center text-xs font-bold text-slate-500 transition hover:text-slate-900"
          >
            ← Back to assignments
          </Link>

          <div className="mt-4 mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-acadlyx-primary">
              Assignment
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {assignment.courseOffering.course.code}
              {" — "}
              {assignment.title}
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Due{" "}
              {new Date(
                assignment.dueDate,
              ).toLocaleDateString(
                undefined,
                {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                },
              )}
              {" · "}
              {assignment.maxMarks} marks
            </p>
          </div>

          {assignment.description ? (
            <DashboardCard
              title="Description"
              className="mb-5"
            >
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {assignment.description}
              </p>
            </DashboardCard>
          ) : null}

          {assignment.mySubmission?.status ===
          "REVIEWED" ? (
            <DashboardCard
              title="Feedback"
              className="mb-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone="success">
                  Reviewed
                </StatusBadge>

                <span className="text-sm font-black text-slate-900">
                  {
                    assignment.mySubmission
                      .marksAwarded
                  }
                  /
                  {
                    assignment.maxMarks
                  }
                </span>
              </div>

              {assignment.mySubmission
                .feedback ? (
                <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {
                    assignment.mySubmission
                      .feedback
                  }
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  No written feedback was provided.
                </p>
              )}
            </DashboardCard>
          ) : null}

          <DashboardCard
            title={
              assignment.mySubmission
                ? "Your Submission"
                : "Submit Your Work"
            }
          >
            {assignment.mySubmission ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <StatusBadge
                  tone={
                    assignment.mySubmission
                      .status === "LATE"
                      ? "warning"
                      : assignment.mySubmission
                            .status ===
                          "REVIEWED"
                        ? "success"
                        : "neutral"
                  }
                >
                  {assignment.mySubmission
                    .status === "LATE"
                    ? "Submitted late"
                    : assignment.mySubmission
                          .status ===
                        "REVIEWED"
                      ? "Reviewed"
                      : "Submitted"}
                </StatusBadge>
              </div>
            ) : null}

            <label
              htmlFor="assignment-submission"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Submission
            </label>

            <textarea
              id="assignment-submission"
              value={content}
              onChange={(event) =>
                setContent(
                  event.target.value,
                )
              }
              rows={8}
              placeholder="Type or paste your submission…"
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-acadlyx-primary focus:ring-2 focus:ring-acadlyx-primary/10"
            />

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-400">
                {assignment.mySubmission
                  ? "Resubmitting replaces your previous submission."
                  : "Make sure your submission is complete before sending it."}
              </p>

              <button
                type="button"
                onClick={() =>
                  void handleSubmit()
                }
                disabled={
                  submitState ===
                    "saving" ||
                  content.trim()
                    .length === 0
                }
                className="rounded-xl bg-acadlyx-primary px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitState ===
                "saving"
                  ? "Submitting…"
                  : assignment.mySubmission
                    ? "Resubmit"
                    : "Submit"}
              </button>
            </div>

            {submitMessage ? (
              <div
                className={[
                  "mt-4 rounded-xl border p-3",
                  submitState ===
                  "error"
                    ? "border-red-200 bg-red-50"
                    : "border-emerald-200 bg-emerald-50",
                ].join(" ")}
              >
                <p
                  className={[
                    "text-sm",
                    submitState ===
                    "error"
                      ? "text-red-700"
                      : "text-emerald-700",
                  ].join(" ")}
                >
                  {submitMessage}
                </p>
              </div>
            ) : null}
          </DashboardCard>
        </div>
      )}
    </DashboardShell>
  );
}
