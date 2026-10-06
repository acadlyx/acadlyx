"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import EntityPicker from "@/components/common/EntityPicker";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser, authedFetch } from "@/lib/auth";
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
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [offerings, setOfferings] = useState<DirectoryOption[]>([]);
  const [tab, setTab] = useState<"learning" | "assessments" | "progress">("learning");
  const [offering, setOffering] = useState<DirectoryOption | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [paper, setPaper] = useState<AttemptPaper | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const role = roles[0] ?? "";
  const isStudent = roles.includes("STUDENT");
  const isParent = roles.includes("PARENT");
  const canAuthor = permissions.includes("lms.manage") && !isParent && !isStudent;
  const canGrade = permissions.includes("lms.grade") && !isStudent && !isParent;
  const workspaceTitle =
    role === "FACULTY" ? "My Teaching" :
    role === "STUDENT" ? "My Learning" :
    role === "HOD" ? "Department LMS" :
    role === "INSTITUTION_ADMIN" ? "LMS Administration" :
    role === "SUPER_ADMIN" ? "LMS Platform" :
    role === "PARENT" ? "Learning Overview" :
    ["CHAIRMAN","MANAGEMENT"].includes(role) ? "LMS Strategic Overview" :
    role === "DIRECTOR" ? "Campus LMS Overview" :
    role === "DEAN" ? "Academic LMS Overview" :
    role === "EXAMINATION" ? "Assessment Integration" :
    "LMS Workspace";

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); }
    catch (err) {
      if (err instanceof AuthRequiredError) { router.replace("/login"); return; }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setBusy(false); }
  }, [router]);

  useEffect(() => {
    void run(async () => {
      const user = await getCurrentUser();
      setPermissions(user?.permissions ?? []);
      setRoles(user?.roles ?? []);
    });
  }, [run]);

  useEffect(() => {
    if (!permissions.includes("lms.read")) return;
    void run(async () => {
      const response = await authedFetch<{ data: DirectoryOption[] }>("/directory/course-offerings");
      setOfferings(response.data ?? []);
    });
  }, [permissions, run]);

  const load = useCallback((offeringId: string) => run(async () => {
    const [moduleList, quizList] = await Promise.all([
      listModules(offeringId),
      listQuizzes(offeringId).catch(() => [] as Quiz[]),
    ]);
    setModules(moduleList); setQuizzes(quizList); setPaper(null);
  }), [run]);

  const selectOffering = (option: DirectoryOption | null) => {
    setOffering(option); setModules([]); setQuizzes([]); setPaper(null);
    if (option) void load(option.id);
  };

  const visibleOfferings = offerings;

  return (
    <DashboardShell title={workspaceTitle} subtitle="Learning, teaching, assessment and progress connected to ACADLYX academic records.">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Workspace", workspaceTitle],
            ["Courses", String(visibleOfferings.length)],
            ["Content", modules.reduce((n, m) => n + m.lessons.length, 0) + " lessons"],
            ["Assessments", String(quizzes.length)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 truncate text-lg font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p>}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap gap-2">{(["learning","assessments","progress"] as const).map((key) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${tab === key ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-600"}`}>{key}</button>)}</div>
          <h2 className="text-lg font-black text-slate-950">{isStudent ? "My Courses" : "Course Offerings"}</h2>
          <p className="mt-1 text-sm text-slate-500">Selections are resolved by the authenticated user's permissions and academic scope.</p>
          <div className="mt-4">
            {visibleOfferings.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleOfferings.map((item) => (
                  <button key={item.id} type="button" onClick={() => router.push(`/lms/${item.id}`)} className={`rounded-2xl border p-4 text-left transition hover:border-slate-400 ${offering?.id === item.id ? "border-slate-950 ring-2 ring-slate-200" : "border-slate-200"}`}>
                    <p className="font-black text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">Open LMS workspace</p>
                  </button>
                ))}
              </div>
            ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No authorized course offerings are available.</p>}
          </div>
        </section>

        {offering && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-black text-slate-950">{offering.label}</h2><p className="text-sm text-slate-500">{canAuthor ? "Teaching and course authoring" : canGrade ? "Teaching, assessment and grading" : "Published learning content"}</p></div>
              {canAuthor && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Author</span>}
            </div>

            {canAuthor && <ModuleForm busy={busy} onSubmit={(title, description) => run(async () => {
              await createModule({ courseOfferingId: offering.id, title, description: description || undefined });
              await load(offering.id); setNotice("Module created.");
            })} />}

            <div className="mt-5 space-y-4">
              {modules.length ? modules.map((module) => (
                <article key={module.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="font-black text-slate-900">{module.sequence}. {module.title}</h3>{module.description && <p className="mt-1 text-sm text-slate-600">{module.description}</p>}</div>
                    {canAuthor && <button type="button" disabled={busy} onClick={() => run(async () => { await updateModule(module.id, { isPublished: !module.isPublished }); await load(offering.id); })} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold">{module.isPublished ? "Unpublish" : "Publish"}</button>}
                  </div>
                  <ul className="mt-4 divide-y divide-slate-100">{module.lessons.map((lesson) => (
                    <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div><p className="font-semibold text-slate-900">{lesson.title}</p><p className="text-xs text-slate-500">{lesson.contentType}{lesson.durationMinutes ? ` · ${lesson.durationMinutes} min` : ""}{lesson.resourceCount ? ` · ${lesson.resourceCount} resource(s)` : ""}</p></div>
                      {isStudent && <button type="button" disabled={busy || lesson.progressStatus === "COMPLETED"} onClick={() => run(async () => { await markLessonProgress(lesson.id, "COMPLETED"); await load(offering.id); })} className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-40">{lesson.progressStatus === "COMPLETED" ? "Completed" : "Mark complete"}</button>}
                    </li>
                  ))}</ul>
                  {canAuthor && <LessonForm busy={busy} onSubmit={(title, content) => run(async () => { await createLesson({ courseModuleId: module.id, title, content: content || undefined }); await load(offering.id); setNotice("Lesson added."); })} />}
                </article>
              )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No authorized content is available for this offering.</p>}
            </div>
          </section>
        )}

        {tab !== "learning" && <section className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black text-slate-950">Assignments & Assessments</h2><p className="mt-1 text-sm text-slate-500">Uses the existing ACADLYX assignment, submission and marks architecture; this workspace does not create a duplicate assignment system.</p><a href={isStudent ? "/student/assignments" : "/faculty/assignments"} className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">{isStudent ? "My assignments" : "Open assignments"}</a></section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black text-slate-950">Attendance & Academic Records</h2><p className="mt-1 text-sm text-slate-500">Attendance, marks and course offerings remain connected to the canonical ERP records.</p><a href={isStudent ? "/student/attendance" : "/faculty/attendance"} className="mt-4 inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Open academic records</a></section>
        </section>}

        {paper && (
          <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6">
            <h2 className="text-lg font-black text-slate-950">{paper.quiz.title}</h2>
            {paper.questions.map((q) => (
              <div key={q.questionBankItemId} className="mt-4 rounded-xl bg-white p-4">
                <p className="font-semibold">{q.sequence}. {q.prompt}</p>
                {q.options.length > 0 ? (
                  q.options.map((o) => {
                    const selected = answers[q.questionBankItemId];
                    const selectedIds = Array.isArray(selected) ? selected : [];
                    const isMultiple = q.questionType === "MULTIPLE_CHOICE";
                    return (
                      <label key={o.id} className="mt-2 flex gap-2 text-sm">
                        <input
                          type={isMultiple ? "checkbox" : "radio"}
                          name={q.questionBankItemId}
                          checked={selectedIds.includes(o.id)}
                          onChange={() =>
                            setAnswers((state) => ({
                              ...state,
                              [q.questionBankItemId]: isMultiple
                                ? selectedIds.includes(o.id)
                                  ? selectedIds.filter((id) => id !== o.id)
                                  : [...selectedIds, o.id]
                                : [o.id],
                            }))
                          }
                        />
                        {o.label}
                      </label>
                    );
                  })
                ) : (
                  <textarea
                    value={typeof answers[q.questionBankItemId] === "string" ? answers[q.questionBankItemId] as string : ""}
                    onChange={(e) =>
                      setAnswers((state) => ({
                        ...state,
                        [q.questionBankItemId]: e.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border p-2"
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await submitAttempt(
                    paper.attemptId,
                    paper.questions.map((q) => {
                      const value = answers[q.questionBankItemId];
                      if (Array.isArray(value)) {
                        return {
                          questionBankItemId: q.questionBankItemId,
                          selectedOptionIds: value,
                        };
                      }
                      return {
                        questionBankItemId: q.questionBankItemId,
                        textAnswer: value ?? "",
                      };
                    }),
                  );
                  setPaper(null);
                  setNotice(
                    result.showResults && result.score !== null
                      ? `Submitted — scored ${result.score} of ${result.maxScore}`
                      : "Submitted. Results will appear once graded.",
                  );
                  if (offering) await load(offering.id);
                })
              }
              className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
            >
              Submit attempt
            </button>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
