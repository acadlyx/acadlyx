import { authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope } from "./httpShared";

/** Typed client for the learning-management module. */

export interface LessonSummary {
  id: string;
  courseModuleId: string;
  title: string;
  summary: string | null;
  contentType: string;
  sequence: number;
  durationMinutes: number | null;
  isPublished: boolean;
  progressStatus: string | null;
  resourceCount: number;
}

export interface CourseModule {
  id: string;
  courseOfferingId: string;
  title: string;
  description: string | null;
  sequence: number;
  isPublished: boolean;
  availableFrom: string | null;
  lessons: LessonSummary[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  status: string;
  totalMarks: number;
  passMarks: number;
  opensAt: string | null;
  closesAt: string | null;
  durationMinutes: number | null;
  attemptsAllowed: number;
  gradingMode: string;
  questionCount: number;
  myAttempts: number;
  myBestScore: number | null;
}

export async function listModules(
  courseOfferingId: string
): Promise<CourseModule[]> {
  const res = await authedFetch<Envelope<CourseModule[]>>(
    `/lms/modules${buildQuery({ courseOfferingId })}`
  );
  return res.data;
}

export async function createModule(body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<CourseModule>>("/lms/modules", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateModule(id: string, body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<CourseModule>>(`/lms/modules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function deleteModule(id: string) {
  const res = await authedFetch<Envelope<{ deleted: boolean }>>(
    `/lms/modules/${id}`,
    { method: "DELETE" }
  );
  return res.data;
}

export async function createLesson(body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    "/lms/lessons",
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function getLesson(id: string) {
  const res = await authedFetch<
    Envelope<{
      lesson: Record<string, unknown>;
      module: CourseModule;
      resources: Array<{
        id: string;
        title: string;
        url: string;
        resourceType: string;
      }>;
    }>
  >(`/lms/lessons/${id}`);
  return res.data;
}

export async function updateLesson(id: string, body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/lms/lessons/${id}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function addResource(
  lessonId: string,
  body: { title: string; url: string; resourceType?: string }
) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/lms/lessons/${lessonId}/resources`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function markLessonProgress(
  lessonId: string,
  status: "IN_PROGRESS" | "COMPLETED",
  secondsSpent?: number
) {
  const res = await authedFetch<Envelope<{ status: string }>>(
    `/lms/lessons/${lessonId}/progress`,
    { method: "POST", body: JSON.stringify({ status, secondsSpent }) }
  );
  return res.data;
}

export async function listQuestions(params: {
  page?: number;
  courseOfferingId?: string;
  questionType?: string;
  search?: string;
}) {
  const res = await authedFetch<PagedEnvelope<Record<string, unknown>>>(
    `/lms/questions${buildQuery(params)}`
  );
  return { items: res.data, total: res.meta.total };
}

export async function createQuestion(body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    "/lms/questions",
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function listQuizzes(courseOfferingId: string): Promise<Quiz[]> {
  const res = await authedFetch<Envelope<Quiz[]>>(
    `/lms/quizzes${buildQuery({ courseOfferingId })}`
  );
  return res.data;
}

export async function createQuiz(body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Quiz>>("/lms/quizzes", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function setQuizQuestions(
  quizId: string,
  questions: Array<{ questionBankItemId: string; marks?: number }>
) {
  const res = await authedFetch<
    Envelope<{ questionCount: number; totalMarks: number }>
  >(`/lms/quizzes/${quizId}/questions`, {
    method: "PUT",
    body: JSON.stringify({ questions }),
  });
  return res.data;
}

export async function setQuizStatus(
  quizId: string,
  status: "DRAFT" | "PUBLISHED" | "CLOSED"
) {
  const res = await authedFetch<Envelope<Quiz>>(
    `/lms/quizzes/${quizId}/status`,
    { method: "PATCH", body: JSON.stringify({ status }) }
  );
  return res.data;
}

export interface AttemptPaper {
  attemptId: string;
  quiz: {
    id: string;
    title: string;
    durationMinutes: number | null;
    totalMarks: number;
    closesAt: string | null;
  };
  questions: Array<{
    questionBankItemId: string;
    sequence: number;
    marks: number;
    prompt: string;
    questionType: string;
    options: Array<{ id: string; label: string }>;
  }>;
}

export async function startAttempt(quizId: string): Promise<AttemptPaper> {
  const res = await authedFetch<Envelope<AttemptPaper>>(
    `/lms/quizzes/${quizId}/attempts`,
    { method: "POST" }
  );
  return res.data;
}

export async function submitAttempt(
  attemptId: string,
  answers: Array<{
    questionBankItemId: string;
    selectedOptionIds?: string[];
    textAnswer?: string;
  }>
) {
  const res = await authedFetch<
    Envelope<{
      status: string;
      score: number | null;
      maxScore: number;
      showResults: boolean;
    }>
  >(`/lms/attempts/${attemptId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
  return res.data;
}

export async function listAttempts(quizId: string) {
  const res = await authedFetch<Envelope<Array<Record<string, unknown>>>>(
    `/lms/quizzes/${quizId}/attempts`
  );
  return res.data;
}

export async function getAttempt(attemptId: string) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/lms/attempts/${attemptId}`
  );
  return res.data;
}

export async function gradeAttempt(
  attemptId: string,
  body: {
    answers: Array<{ answerId: string; awardedMarks: number; feedback?: string }>;
    feedback?: string;
  }
) {
  const res = await authedFetch<Envelope<{ score: number }>>(
    `/lms/attempts/${attemptId}/grade`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function getOfferingProgress(courseOfferingId: string) {
  const res = await authedFetch<
    Envelope<{
      totalLessons: number;
      students: Array<{
        studentId: string;
        firstName: string;
        lastName: string;
        rollNumber: string | null;
        completedLessons: number;
        completionPercentage: number | null;
      }>;
    }>
  >(`/lms/progress/offering${buildQuery({ courseOfferingId })}`);
  return res.data;
}
