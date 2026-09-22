"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import EntityPicker from "@/components/common/EntityPicker";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { DirectoryOption } from "@/lib/directoryApi";
import {
  AttemptPaper,
  CourseModule,
  Quiz,
  createLesson,
  createModule,
  listModules,
  listQuizzes,
  markLessonProgress,
  setQuizStatus,
  startAttempt,
  submitAttempt,
  updateModule,
} from "@/lib/lmsApi";

/**
 * Course material and quizzes.
 *
 * One screen serves both sides: a teacher sees authoring controls and
 * unpublished drafts, a student sees only published material and their
 * own progress. The backend decides which of the two you are — this
 * page only decides what to render.
 */

type Tab = "content" | "quizzes";

export default function LmsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("content");
  const [roles, setRoles] = useState<string[]>([]);
  const [offering, setOffering] = useState<DirectoryOption | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [paper, setPaper] = useState<AttemptPaper | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canAuthor = roles.some((role) =>
    ["SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT", "HOD", "FACULTY"].includes(
      role
    )
  );
  const isStudent = roles.includes("STUDENT");

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await fn();
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  useEffect(() => {
    void run(async () => {
      const user = await getCurrentUser();
      setRoles(user?.roles ?? []);
    });
  }, [run]);

  const load = useCallback(
    (offeringId: string) =>
      run(async () => {
        const [moduleList, quizList] = await Promise.all([
          listModules(offeringId),
          listQuizzes(offeringId).catch(() => [] as Quiz[]),
        ]);
        setModules(moduleList);
        setQuizzes(quizList);
      }),
    [run]
  );

  return (
    <DashboardShell
      title="Course material"
      subtitle="Modules, lessons, resources and quizzes"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <EntityPicker
            kind="courseOffering"
            label="Course offering"
            value={offering}
            onChange={(option) => {
              setOffering(option);
              setModules([]);
              setQuizzes([]);
              setPaper(null);
              if (option) void load(option.id);
            }}
          />
        </section>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        {offering && (
          <>
            <div className="flex gap-2">
              {(["content", "quizzes"] as Tab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${
                    tab === key
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {tab === "content" && (
              <>
                {canAuthor && (
                  <ModuleForm
                    busy={busy}
                    onSubmit={(title, description) =>
                      run(async () => {
                        await createModule({
                          courseOfferingId: offering.id,
                          title,
                          description: description || undefined,
                        });
                        await load(offering.id);
                        setNotice("Module created");
                      })
                    }
                  />
                )}

                {modules.length === 0 ? (
                  <p className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                    No course material published for this offering yet.
                  </p>
                ) : (
                  modules.map((module) => (
                    <section
                      key={module.id}
                      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">
                            {module.sequence}. {module.title}
                          </h2>
                          {module.description && (
                            <p className="text-sm text-slate-600">
                              {module.description}
                            </p>
                          )}
                        </div>
                        {canAuthor && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await updateModule(module.id, {
                                  isPublished: !module.isPublished,
                                });
                                await load(offering.id);
                              })
                            }
                            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                              module.isPublished
                                ? "border border-slate-300 text-slate-600"
                                : "bg-emerald-600 text-white"
                            }`}
                          >
                            {module.isPublished ? "Unpublish" : "Publish"}
                          </button>
                        )}
                      </div>

                      <ul className="divide-y divide-slate-100">
                        {module.lessons.map((lesson) => (
                          <li
                            key={lesson.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-3"
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {lesson.title}
                                {!lesson.isPublished && (
                                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                    draft
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                {lesson.contentType}
                                {lesson.durationMinutes
                                  ? ` · ${lesson.durationMinutes} min`
                                  : ""}
                                {lesson.resourceCount > 0
                                  ? ` · ${lesson.resourceCount} resource(s)`
                                  : ""}
                              </p>
                            </div>
                            {isStudent && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">
                                  {lesson.progressStatus ?? "NOT_STARTED"}
                                </span>
                                {lesson.progressStatus !== "COMPLETED" && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      run(async () => {
                                        await markLessonProgress(
                                          lesson.id,
                                          "COMPLETED"
                                        );
                                        await load(offering.id);
                                      })
                                    }
                                    className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                                  >
                                    Mark complete
                                  </button>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>

                      {canAuthor && (
                        <LessonForm
                          busy={busy}
                          onSubmit={(title, content) =>
                            run(async () => {
                              await createLesson({
                                courseModuleId: module.id,
                                title,
                                content: content || undefined,
                              });
                              await load(offering.id);
                              setNotice("Lesson added");
                            })
                          }
                        />
                      )}
                    </section>
                  ))
                )}
              </>
            )}

            {tab === "quizzes" && !paper && (
              <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Quizzes</h2>
                {quizzes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No quizzes for this offering.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {quizzes.map((quiz) => (
                      <li
                        key={quiz.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {quiz.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {quiz.questionCount} question(s) ·{" "}
                            {quiz.totalMarks} marks · {quiz.status}
                            {quiz.closesAt
                              ? ` · closes ${new Date(quiz.closesAt).toLocaleString()}`
                              : ""}
                            {quiz.myAttempts > 0
                              ? ` · ${quiz.myAttempts}/${quiz.attemptsAllowed} attempt(s) used`
                              : ""}
                            {quiz.myBestScore !== null
                              ? ` · best ${quiz.myBestScore}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {canAuthor && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  await setQuizStatus(
                                    quiz.id,
                                    quiz.status === "PUBLISHED"
                                      ? "CLOSED"
                                      : "PUBLISHED"
                                  );
                                  await load(offering.id);
                                })
                              }
                              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
                            >
                              {quiz.status === "PUBLISHED" ? "Close" : "Publish"}
                            </button>
                          )}
                          {isStudent &&
                            quiz.status === "PUBLISHED" &&
                            quiz.myAttempts < quiz.attemptsAllowed && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  run(async () => {
                                    setPaper(await startAttempt(quiz.id));
                                    setAnswers({});
                                  })
                                }
                                className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                              >
                                Start attempt
                              </button>
                            )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {paper && (
              <section className="space-y-5 rounded-3xl border border-indigo-200 bg-indigo-50/60 p-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {paper.quiz.title}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {paper.quiz.totalMarks} marks
                    {paper.quiz.durationMinutes
                      ? ` · ${paper.quiz.durationMinutes} minutes`
                      : ""}
                  </p>
                </div>

                {paper.questions.map((question) => (
                  <div
                    key={question.questionBankItemId}
                    className="rounded-2xl bg-white p-5"
                  >
                    <p className="font-medium text-slate-900">
                      {question.sequence}. {question.prompt}
                      <span className="ml-2 text-xs text-slate-400">
                        ({question.marks} marks)
                      </span>
                    </p>

                    {question.options.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {question.options.map((option) => {
                          const current =
                            (answers[question.questionBankItemId] as string[]) ??
                            [];
                          const multiple =
                            question.questionType === "MULTIPLE_CHOICE";
                          const checked = current.includes(option.id);
                          return (
                            <li key={option.id}>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type={multiple ? "checkbox" : "radio"}
                                  name={question.questionBankItemId}
                                  checked={checked}
                                  onChange={() =>
                                    setAnswers((state) => ({
                                      ...state,
                                      [question.questionBankItemId]: multiple
                                        ? checked
                                          ? current.filter(
                                              (id) => id !== option.id
                                            )
                                          : [...current, option.id]
                                        : [option.id],
                                    }))
                                  }
                                />
                                {option.label}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <textarea
                        rows={4}
                        value={
                          (answers[question.questionBankItemId] as string) ?? ""
                        }
                        onChange={(event) =>
                          setAnswers((state) => ({
                            ...state,
                            [question.questionBankItemId]: event.target.value,
                          }))
                        }
                        className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                ))}

                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const payload = paper.questions.map((question) => {
                          const value = answers[question.questionBankItemId];
                          return Array.isArray(value)
                            ? {
                                questionBankItemId: question.questionBankItemId,
                                selectedOptionIds: value,
                              }
                            : {
                                questionBankItemId: question.questionBankItemId,
                                textAnswer: (value as string) ?? "",
                              };
                        });
                        const result = await submitAttempt(
                          paper.attemptId,
                          payload
                        );
                        setPaper(null);
                        setNotice(
                          result.showResults && result.score !== null
                            ? `Submitted — scored ${result.score} of ${result.maxScore}`
                            : "Submitted. Results will appear once graded."
                        );
                        if (offering) await load(offering.id);
                      })
                    }
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Submit attempt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaper(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Abandon
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function ModuleForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (title: string, description: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(title, description);
        setTitle("");
        setDescription("");
      }}
      className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">
          New module
        </span>
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Unit 1 — Foundations"
          className="w-64 rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="flex-1 text-sm">
        <span className="mb-1 block font-medium text-slate-600">
          Description
        </span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
      >
        Add module
      </button>
    </form>
  );
}

function LessonForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (title: string, content: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(title, content);
        setTitle("");
        setContent("");
      }}
      className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4"
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">
          New lesson
        </span>
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-56 rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="flex-1 text-sm">
        <span className="mb-1 block font-medium text-slate-600">Content</span>
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
      >
        Add lesson
      </button>
    </form>
  );
}
