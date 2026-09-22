"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  authedFetch,
} from "@/lib/auth";

type Center = {
  kpis: {
    students: number;
    faculty: number;
    departments: number;
    attendance: number;
    pendingAssignments: number;
  };

  recommendedActions: string[];

  atRiskStudents: Array<{
    student: {
      firstName: string;
      lastName: string;
    };

    risk: string;

    scores: {
      academicHealth: number;
    };

    recommendations: string[];
  }>;
};

type AskAnswer = {
  answer: string;
  evidence: unknown;
  actions: string[];
};

type Metric = {
  label: string;
  value: string | number;
  description: string;
};

const questions = [
  "Which students require immediate academic intervention?",
  "Which departments need attention this month?",
  "Which department has the largest attendance decline?",
  "What are the biggest placement skill gaps?",
];

function formatNumber(
  value: number,
): string {
  return value.toLocaleString("en-IN");
}

function IntelligenceMetric({
  metric,
}: {
  metric: Metric;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {metric.label}
        </p>

        <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
      </div>

      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        {metric.value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-400">
        {metric.description}
      </p>
    </article>
  );
}

function MetricSkeleton() {
  return (
    <div className="h-[156px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
  );
}

function IntelligenceLoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-56 animate-pulse rounded bg-slate-200" />

        <div className="h-9 w-[420px] max-w-full animate-pulse rounded-lg bg-slate-200" />

        <div className="h-4 w-[600px] max-w-full animate-pulse rounded bg-slate-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({
          length: 5,
        }).map((_, index) => (
          <MetricSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-[360px] animate-pulse rounded-2xl bg-white" />

        <div className="h-[360px] animate-pulse rounded-2xl bg-white" />
      </div>

      <div className="h-48 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}

function RiskBadge({
  risk,
}: {
  risk: string;
}) {
  const normalized =
    risk.toLowerCase();

  const isHigh =
    normalized.includes("high") ||
    normalized.includes("critical");

  const isMedium =
    normalized.includes("medium") ||
    normalized.includes("moderate");

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
        isHigh
          ? "bg-red-50 text-red-700"
          : isMedium
            ? "bg-amber-50 text-amber-700"
            : "bg-slate-100 text-slate-600",
      ].join(" ")}
    >
      {risk}
    </span>
  );
}

function AtRiskStudents({
  students,
}: {
  students: Center["atRiskStudents"];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Academic monitoring
          </p>

          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
            Students requiring intervention
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            Students currently surfaced by the intelligence workspace.
          </p>
        </div>

        <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700">
          {students.length} flagged
        </span>
      </div>

      <div className="mt-5">
        {students.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {students.map(
              (student, index) => {
                const fullName =
                  `${student.student.firstName} ${student.student.lastName}`.trim();

                return (
                  <div
                    key={`${fullName}-${index}`}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {fullName ||
                            "Student"}
                        </p>

                        <RiskBadge
                          risk={
                            student.risk
                          }
                        />
                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {student
                          .recommendations?.[0] ||
                          "Faculty review required"}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Academic health
                      </p>

                      <p className="mt-0.5 text-lg font-black text-slate-900">
                        {
                          student
                            .scores
                            .academicHealth
                        }
                      </p>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              ✓
            </div>

            <p className="mt-3 text-sm font-bold text-slate-700">
              No high-risk students in the permitted scope
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              The current intelligence response did not flag any
              high-risk students.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function AskAcadlyx({
  question,
  setQuestion,
  answer,
  error,
  submitting,
  onSubmit,
}: {
  question: string;
  setQuestion: (
    value: string,
  ) => void;
  answer: AskAnswer | null;
  error: string;
  submitting: boolean;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
}) {
  return (
    <section className="rounded-2xl border border-slate-900 bg-slate-950 p-5 text-white shadow-sm">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">
          AI workspace
        </p>

        <h2 className="mt-1 text-lg font-black tracking-tight">
          Ask ACADLYX
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-400">
          Ask an institutional intelligence question using the
          currently permitted data scope.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-5"
      >
        <label
          htmlFor="acadlyx-question"
          className="sr-only"
        >
          Ask ACADLYX a question
        </label>

        <textarea
          id="acadlyx-question"
          value={question}
          onChange={(event) =>
            setQuestion(
              event.target.value,
            )
          }
          rows={4}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20"
          placeholder="Ask about academic, operational, or career intelligence..."
        />

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-5 text-slate-500">
            Use one of the suggested questions below or write your own.
          </p>

          <button
            type="submit"
            disabled={
              submitting ||
              !question.trim()
            }
            className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Thinking…"
              : "Ask ACADLYX →"}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {questions.map(
          (suggestedQuestion) => (
            <button
              key={suggestedQuestion}
              type="button"
              onClick={() =>
                setQuestion(
                  suggestedQuestion,
                )
              }
              className={[
                "rounded-full border px-3 py-1.5 text-[10px] font-semibold transition",
                question ===
                suggestedQuestion
                  ? "border-violet-400/40 bg-violet-400/10 text-violet-200"
                  : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
              ].join(" ")}
            >
              {suggestedQuestion}
            </button>
          ),
        )}
      </div>

      {answer ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-300">
            ACADLYX response
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-200">
            {answer.answer}
          </p>

          {answer.actions.length >
          0 ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Suggested actions
              </p>

              <div className="mt-2 space-y-1.5">
                {answer.actions.map(
                  (action) => (
                    <p
                      key={action}
                      className="text-xs leading-5 text-slate-400"
                    >
                      • {action}
                    </p>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3">
          <p className="text-xs leading-5 text-red-300">
            {error}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function RecommendedActions({
  actions,
}: {
  actions: string[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Intelligence recommendations
        </p>

        <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
          Recommended actions
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          Actions returned by the current intelligence analysis.
        </p>
      </div>

      {actions.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {actions.map(
            (action, index) => (
              <div
                key={`${action}-${index}`}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-xs font-black text-violet-600">
                  {index + 1}
                </span>

                <p className="text-sm leading-6 text-slate-600">
                  {action}
                </p>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-600">
            No current escalation
          </p>

          <p className="mt-1 text-xs text-slate-400">
            There are no recommended actions in the current response.
          </p>
        </div>
      )}
    </section>
  );
}

export default function IntelligencePage() {
  const router = useRouter();

  const [center, setCenter] =
    useState<Center | null>(null);

  const [question, setQuestion] =
    useState(questions[0]);

  const [answer, setAnswer] =
    useState<AskAnswer | null>(null);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    authedFetch<{
      data: Center;
    }>("/intelligence/command-center")
      .then((response) => {
        if (!mounted) {
          return;
        }

        setCenter(response.data);
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }

        if (
          requestError instanceof AuthRequiredError
        ) {
          router.replace("/login");
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load intelligence.",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  const metrics = useMemo<
    Metric[]
  >(() => {
    if (!center) {
      return [];
    }

    return [
      {
        label: "Students",
        value: formatNumber(
          center.kpis.students,
        ),
        description:
          "Students within the permitted intelligence scope.",
      },
      {
        label: "Faculty",
        value: formatNumber(
          center.kpis.faculty,
        ),
        description:
          "Faculty represented in the intelligence workspace.",
      },
      {
        label: "Departments",
        value: formatNumber(
          center.kpis.departments,
        ),
        description:
          "Departments represented in the current scope.",
      },
      {
        label: "Attendance",
        value: `${center.kpis.attendance}%`,
        description:
          "Current attendance metric returned by the intelligence service.",
      },
      {
        label: "Overdue work",
        value: formatNumber(
          center.kpis.pendingAssignments,
        ),
        description:
          "Pending assignment workload currently surfaced.",
      },
    ];
  }, [center]);

  async function ask(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!question.trim()) {
      return;
    }

    setError("");
    setSubmitting(true);
    setAnswer(null);

    try {
      const response =
        await authedFetch<{
          data: AskAnswer;
        }>("/ask-acadlyx", {
          method: "POST",
          body: JSON.stringify({
            question:
              question.trim(),
          }),
        });

      setAnswer(response.data);
    } catch (requestError) {
      if (
        requestError instanceof AuthRequiredError
      ) {
        router.replace("/login");
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to answer the question.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell
        title="Institution Intelligence"
        subtitle="Academic, operational and career intelligence"
        allowedRoles={[
          "SUPER_ADMIN",
          "INSTITUTION_ADMIN",
          "DIRECTOR",
          "MANAGEMENT",
          "HOD",
        ]}
      >
        <IntelligenceLoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Institution Intelligence"
      subtitle="Academic, operational and career intelligence"
      allowedRoles={[
        "SUPER_ADMIN",
        "INSTITUTION_ADMIN",
        "DIRECTOR",
        "MANAGEMENT",
        "HOD",
      ]}
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* =====================================================
            INTRO
            ===================================================== */}
        <section className="mb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-500">
                ACADLYX · Institutional intelligence
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Academic, operational and career intelligence
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Monitor institutional signals, identify areas requiring
                attention, and ask ACADLYX questions about the data
                available to your role.
              </p>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Intelligence connected
            </span>
          </div>
        </section>

        {/* =====================================================
            ERROR
            ===================================================== */}
        {error && !center ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-900">
              Intelligence could not be loaded
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        ) : null}

        {center ? (
          <>
            {/* =================================================
                KPI CARDS
                ================================================= */}
            <section aria-label="Intelligence metrics">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {metrics.map(
                  (metric) => (
                    <IntelligenceMetric
                      key={metric.label}
                      metric={metric}
                    />
                  ),
                )}
              </div>
            </section>

            {/* =================================================
                MAIN INTELLIGENCE WORKSPACE
                ================================================= */}
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <AtRiskStudents
                students={
                  center.atRiskStudents
                }
              />

              <AskAcadlyx
                question={question}
                setQuestion={
                  setQuestion
                }
                answer={answer}
                error={
                  error && center
                    ? error
                    : ""
                }
                submitting={
                  submitting
                }
                onSubmit={ask}
              />
            </div>

            {/* =================================================
                RECOMMENDED ACTIONS
                ================================================= */}
            <div className="mt-5">
              <RecommendedActions
                actions={
                  center.recommendedActions
                }
              />
            </div>

            {/* =================================================
                STATUS FOOTER
                ================================================= */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    ACADLYX Intelligence
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Intelligence results are limited to the data and
                    permissions available to the authenticated user.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />

                  <span className="text-[11px] font-semibold text-slate-500">
                    Live data
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
