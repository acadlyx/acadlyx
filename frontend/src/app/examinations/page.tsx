"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import EntityPicker from "@/components/common/EntityPicker";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { DirectoryOption } from "@/lib/directoryApi";
import {
  ExamRoom,
  ExamSchedule,
  ExamSession,
  MarksRow,
  allocateSeating,
  approveMarks,
  createExamRoom,
  createExamSchedule,
  createExamSession,
  generateHallTickets,
  getExamSession,
  getMarksSheet,
  listExamRooms,
  listExamSessions,
  lockSchedule,
  publishResults,
  saveMarks,
  setSessionStatus,
} from "@/lib/examinationsApi";

type Tab = "sessions" | "marks";

const CONTROLLER_ROLES = ["EXAMINATION", "DIRECTOR"];

const SESSION_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ONGOING",
  "COMPLETED",
  "PUBLISHED",
  "CANCELLED",
];

const EXAM_TYPES = [
  "REGULAR",
  "SUPPLEMENTARY",
  "REVALUATION",
  "IMPROVEMENT",
];

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string) {
  switch (status) {
    case "PUBLISHED":
    case "RESULTS_PUBLISHED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    case "ONGOING":
      return "bg-blue-50 text-blue-700 ring-blue-200";

    case "SCHEDULED":
    case "PUBLISHED":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";

    case "COMPLETED":
    case "APPROVED":
      return "bg-violet-50 text-violet-700 ring-violet-200";

    case "LOCKED":
      return "bg-amber-50 text-amber-700 ring-amber-200";

    case "CANCELLED":
      return "bg-red-50 text-red-700 ring-red-200";

    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function isValidNumber(value: string) {
  if (value.trim() === "") return true;

  const number = Number(value);

  return Number.isFinite(number) && number >= 0;
}

export default function ExaminationsPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("sessions");
  const [roles, setRoles] = useState<string[]>([]);

  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [rooms, setRooms] = useState<ExamRoom[]>([]);

  const [active, setActive] = useState<
    (ExamSession & { schedules: ExamSchedule[] }) | null
  >(null);

  const [sheet, setSheet] = useState<{
    schedule: ExamSchedule;
    rows: MarksRow[];
  } | null>(null);

  const [draft, setDraft] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = roles.some((role) =>
    CONTROLLER_ROLES.includes(role)
  );

  const canApprove = canManage;

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

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while processing the request."
        );
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const reload = useCallback(async () => {
    const [sessionResult, roomResult] = await Promise.all([
      listExamSessions({ page: 1 }),
      listExamRooms().catch(() => [] as ExamRoom[]),
    ]);

    setSessions(sessionResult.items);
    setRooms(roomResult);
  }, []);

  const loadInitialData = useCallback(async () => {
    setInitialLoading(true);
    setError("");

    try {
      const user = await getCurrentUser();

      setRoles(user?.roles ?? []);

      await reload();
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the examination workspace."
      );
    } finally {
      setInitialLoading(false);
    }
  }, [reload, router]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  async function openSession(id: string) {
    await run(async () => {
      const session = await getExamSession(id);

      setActive(session);
      setSheet(null);
      setTab("sessions");
    });
  }

  async function openMarks(scheduleId: string) {
    await run(async () => {
      const data = await getMarksSheet(scheduleId);

      setSheet(data);

      setDraft(
        Object.fromEntries(
          data.rows.map((row) => [
            row.studentId,
            row.isAbsent
              ? "AB"
              : row.marksObtained?.toString() ?? "",
          ])
        )
      );

      setTab("marks");
    });
  }

  function marksPayload() {
    if (!sheet) {
      return [];
    }

    return sheet.rows.map((row) => {
      const raw = (draft[row.studentId] ?? "")
        .trim()
        .toUpperCase();

      if (raw === "AB") {
        return {
          studentId: row.studentId,
          isAbsent: true,
          marksObtained: null,
        };
      }

      return {
        studentId: row.studentId,
        isAbsent: false,
        marksObtained:
          raw === "" ? null : Number(raw),
      };
    });
  }

  const metrics = useMemo(() => {
    const activeSessions = sessions.filter(
      (session) =>
        session.status !== "CANCELLED" &&
        session.status !== "PUBLISHED"
    ).length;

    const publishedSessions = sessions.filter(
      (session) => session.status === "PUBLISHED"
    ).length;

    const scheduledSessions = sessions.filter(
      (session) =>
        session.status === "SCHEDULED" ||
        session.status === "ONGOING"
    ).length;

    const papers = sessions.reduce(
      (total, session) => total,
      0
    );

    return {
      totalSessions: sessions.length,
      activeSessions,
      scheduledSessions,
      publishedSessions,
      rooms: rooms.length,
      papers,
    };
  }, [sessions, rooms]);

  return (
    <DashboardShell
      title="Examination Cell"
      subtitle="Examination control, scheduling, seating, admit cards, marks and result publication"
    >
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                Examination operations
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight">
                Examination Control Center
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Manage the complete controlled examination lifecycle:
                session creation, paper scheduling, room allocation,
                seating, admit-card generation, marks approval,
                locking and result publication.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void reload()}
                disabled={busy || initialLoading}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-50"
              >
                Refresh
              </button>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setTab("sessions")}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
                >
                  Examination sessions
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Total sessions"
            value={metrics.totalSessions}
            detail="All examination windows"
          />

          <MetricCard
            label="Active pipeline"
            value={metrics.activeSessions}
            detail="Not cancelled or published"
          />

          <MetricCard
            label="Scheduled / ongoing"
            value={metrics.scheduledSessions}
            detail="Current operational sessions"
          />

          <MetricCard
            label="Published"
            value={metrics.publishedSessions}
            detail="Completed result lifecycle"
          />

          <MetricCard
            label="Exam rooms"
            value={metrics.rooms}
            detail="Active room inventory"
          />
        </section>

        <section className="flex flex-wrap gap-2">
          <TabButton
            active={tab === "sessions"}
            onClick={() => setTab("sessions")}
          >
            Sessions & schedules
          </TabButton>

          <TabButton
            active={tab === "marks"}
            onClick={() => setTab("marks")}
          >
            Marks & approvals
          </TabButton>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
          >
            {notice}
          </div>
        )}

        {initialLoading ? (
          <LoadingWorkspace />
        ) : tab === "sessions" ? (
          <SessionsWorkspace
            sessions={sessions}
            rooms={rooms}
            active={active}
            busy={busy}
            canManage={canManage}
            canApprove={canApprove}
            onCreateSession={(body) =>
              void run(async () => {
                const created = await createExamSession(body);

                setNotice(
                  `Examination session "${created.name}" created successfully.`
                );

                await reload();
              })
            }
            onOpenSession={(id) => void openSession(id)}
            onRefreshSession={() => {
              if (active) {
                void openSession(active.id);
              }
            }}
            onSchedule={(body) =>
              void run(async () => {
                if (!active) return;

                await createExamSchedule({
                  ...body,
                  examSessionId: active.id,
                });

                setNotice("Examination paper scheduled successfully.");

                setActive(await getExamSession(active.id));
                await reload();
              })
            }
            onCreateRoom={(body) =>
              void run(async () => {
                await createExamRoom(body);

                setNotice("Examination room created successfully.");

                setRooms(await listExamRooms());
              })
            }
            onSeating={(scheduleId, roomIds) =>
              void run(async () => {
                if (!active) return;

                const result = await allocateSeating(
                  scheduleId,
                  roomIds
                );

                setNotice(
                  `Seating allocated for ${result.seated} students across ${result.rooms} room(s).`
                );

                setActive(await getExamSession(active.id));
              })
            }
            onHallTickets={() =>
              void run(async () => {
                if (!active) return;

                const result = await generateHallTickets(
                  active.id
                );

                setNotice(
                  `Admit-card generation completed: ${result.issued} issued, ${result.blocked} blocked by eligibility rules.`
                );

                setActive(await getExamSession(active.id));
              })
            }
            onStatus={(status) =>
              void run(async () => {
                if (!active) return;

                await setSessionStatus(
                  active.id,
                  status
                );

                setNotice(
                  `Examination session moved to ${status}.`
                );

                setActive(await getExamSession(active.id));
                await reload();
              })
            }
            onOpenMarks={(scheduleId) =>
              void openMarks(scheduleId)
            }
            onLock={(scheduleId) =>
              void run(async () => {
                if (!active) return;

                await lockSchedule(scheduleId);

                setNotice(
                  "Marks schedule locked successfully."
                );

                setActive(await getExamSession(active.id));
              })
            }
            onPublish={(scheduleId) =>
              void run(async () => {
                if (!active) return;

                const result =
                  await publishResults(scheduleId);

                setNotice(
                  `Results published for ${result.published} student result(s).`
                );

                setActive(await getExamSession(active.id));
              })
            }
          />
        ) : (
          <MarksWorkspace
            sheet={sheet}
            draft={draft}
            busy={busy}
            canManage={canManage}
            canApprove={canApprove}
            setDraft={setDraft}
            onSave={() =>
              void run(async () => {
                if (!sheet) return;

                const payload = marksPayload();

                const invalid = payload.some(
                  (entry) =>
                    entry.marksObtained !== null &&
                    (!Number.isFinite(
                      entry.marksObtained
                    ) ||
                      entry.marksObtained < 0)
                );

                if (invalid) {
                  throw new Error(
                    "One or more marks entries are invalid."
                  );
                }

                await saveMarks(
                  sheet.schedule.id,
                  payload,
                  false
                );

                setNotice("Marks draft saved successfully.");

                const refreshed =
                  await getMarksSheet(
                    sheet.schedule.id
                  );

                setSheet(refreshed);

                setDraft(
                  Object.fromEntries(
                    refreshed.rows.map((row) => [
                      row.studentId,
                      row.isAbsent
                        ? "AB"
                        : row.marksObtained?.toString() ??
                          "",
                    ])
                  )
                );
              })
            }
            onSubmit={() =>
              void run(async () => {
                if (!sheet) return;

                const payload = marksPayload();

                await saveMarks(
                  sheet.schedule.id,
                  payload,
                  true
                );

                setNotice(
                  "Marks submitted for approval."
                );

                const refreshed =
                  await getMarksSheet(
                    sheet.schedule.id
                  );

                setSheet(refreshed);
              })
            }
            onApprove={() =>
              void run(async () => {
                if (!sheet) return;

                const result =
                  await approveMarks(
                    sheet.schedule.id
                  );

                setNotice(
                  `${result.approved} mark entries approved successfully.`
                );

                const refreshed =
                  await getMarksSheet(
                    sheet.schedule.id
                  );

                setSheet(refreshed);
              })
            }
          />
        )}
      </div>
    </DashboardShell>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm"
          : "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      }
    >
      {children}
    </button>
  );
}

function LoadingWorkspace() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6"
        >
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="mt-4 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
          <div className="mt-6 h-10 w-32 rounded-xl bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function SessionsWorkspace({
  sessions,
  rooms,
  active,
  busy,
  canManage,
  canApprove,
  onCreateSession,
  onOpenSession,
  onRefreshSession,
  onSchedule,
  onCreateRoom,
  onSeating,
  onHallTickets,
  onStatus,
  onOpenMarks,
  onLock,
  onPublish,
}: {
  sessions: ExamSession[];
  rooms: ExamRoom[];
  active:
    | (ExamSession & {
        schedules: ExamSchedule[];
      })
    | null;
  busy: boolean;
  canManage: boolean;
  canApprove: boolean;
  onCreateSession: (body: {
    name: string;
    code: string;
    examType: string;
    startDate: string;
    endDate: string;
  }) => void;
  onOpenSession: (id: string) => void;
  onRefreshSession: () => void;
  onSchedule: (body: {
    courseOfferingId: string;
    examDate: string;
    startTime: string;
    endTime: string;
    maxMarks: number;
    passMarks: number;
  }) => void;
  onCreateRoom: (body: {
    name: string;
    code: string;
    capacity: number;
  }) => void;
  onSeating: (
    scheduleId: string,
    roomIds: string[]
  ) => void;
  onHallTickets: () => void;
  onStatus: (status: string) => void;
  onOpenMarks: (scheduleId: string) => void;
  onLock: (scheduleId: string) => void;
  onPublish: (scheduleId: string) => void;
}) {
  return (
    <>
      {canManage && (
        <NewSessionForm
          busy={busy}
          onCreate={onCreateSession}
        />
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Master examination windows
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">
              Examination sessions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Every paper, seating allocation, admit card and result
              publication belongs to one controlled session.
            </p>
          </div>

          <p className="text-xs font-medium text-slate-400">
            {sessions.length} session(s)
          </p>
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            title="No examination sessions"
            description={
              canManage
                ? "Create the first examination session to start the examination workflow."
                : "No examination sessions are currently available."
            }
          />
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">
                    Session
                  </th>
                  <th className="pb-3 pr-4">
                    Type
                  </th>
                  <th className="pb-3 pr-4">
                    Examination window
                  </th>
                  <th className="pb-3 pr-4">
                    Status
                  </th>
                  <th className="pb-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="py-4 pr-4">
                      <div className="font-bold text-slate-900">
                        {session.name}
                      </div>

                      <div className="mt-0.5 text-xs text-slate-400">
                        {session.code}
                      </div>
                    </td>

                    <td className="py-4 pr-4 text-slate-600">
                      {session.examType}
                    </td>

                    <td className="py-4 pr-4 text-slate-600">
                      <div>
                        {formatDate(
                          session.startDate
                        )}
                      </div>

                      <div className="text-xs text-slate-400">
                        to{" "}
                        {formatDate(
                          session.endDate
                        )}
                      </div>
                    </td>

                    <td className="py-4 pr-4">
                      <StatusPill
                        status={session.status}
                      />
                    </td>

                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenSession(session.id)
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Open workspace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {active && (
        <SessionWorkspace
          session={active}
          rooms={rooms}
          busy={busy}
          canManage={canManage}
          canApprove={canApprove}
          onRefresh={onRefreshSession}
          onSchedule={onSchedule}
          onCreateRoom={onCreateRoom}
          onSeating={onSeating}
          onHallTickets={onHallTickets}
          onStatus={onStatus}
          onOpenMarks={onOpenMarks}
          onLock={onLock}
          onPublish={onPublish}
        />
      )}
    </>
  );
}

function NewSessionForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (body: {
    name: string;
    code: string;
    examType: string;
    startDate: string;
    endDate: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    examType: "REGULAR",
    startDate: "",
    endDate: "",
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    if (!form.code.trim()) {
      return;
    }

    if (!form.startDate || !form.endDate) {
      return;
    }

    if (
      new Date(form.endDate) <
      new Date(form.startDate)
    ) {
      return;
    }

    onCreate({
      ...form,
      name: form.name.trim(),
      code: form.code.trim(),
    });

    setForm({
      name: "",
      code: "",
      examType: form.examType,
      startDate: "",
      endDate: "",
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Session control
        </p>

        <h2 className="mt-1 text-xl font-black text-slate-950">
          Create examination session
        </h2>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          This is the master examination window. Papers, seating,
          admit cards and results are controlled beneath this session.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="grid gap-4 lg:grid-cols-12"
      >
        <label className="space-y-1.5 lg:col-span-4">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Session name
          </span>

          <input
            required
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="End Semester Examination — Nov 2026"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </label>

        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Code
          </span>

          <input
            required
            value={form.code}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                code: event.target.value,
              }))
            }
            placeholder="ESE-NOV26"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </label>

        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Examination type
          </span>

          <select
            value={form.examType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                examType: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
          >
            {EXAM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Start date
          </span>

          <input
            required
            type="date"
            value={form.startDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                startDate: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </label>

        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            End date
          </span>

          <input
            required
            type="date"
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                endDate: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </label>

        <div className="lg:col-span-12">
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "Creating session..."
              : "Create examination session"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SessionWorkspace({
  session,
  rooms,
  busy,
  canManage,
  canApprove,
  onRefresh,
  onSchedule,
  onCreateRoom,
  onSeating,
  onHallTickets,
  onStatus,
  onOpenMarks,
  onLock,
  onPublish,
}: {
  session: ExamSession & {
    schedules: ExamSchedule[];
  };
  rooms: ExamRoom[];
  busy: boolean;
  canManage: boolean;
  canApprove: boolean;
  onRefresh: () => void;
  onSchedule: (body: {
    courseOfferingId: string;
    examDate: string;
    startTime: string;
    endTime: string;
    maxMarks: number;
    passMarks: number;
  }) => void;
  onCreateRoom: (body: {
    name: string;
    code: string;
    capacity: number;
  }) => void;
  onSeating: (
    scheduleId: string,
    roomIds: string[]
  ) => void;
  onHallTickets: () => void;
  onStatus: (status: string) => void;
  onOpenMarks: (scheduleId: string) => void;
  onLock: (scheduleId: string) => void;
  onPublish: (scheduleId: string) => void;
}) {
  const [showScheduleForm, setShowScheduleForm] =
    useState(false);

  const [showRoomForm, setShowRoomForm] =
    useState(false);

  const [hallTicketBusy, setHallTicketBusy] =
    useState(false);

  return (
    <section className="space-y-5 rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5 sm:p-6">
      <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-500">
                Active examination session
              </span>

              <StatusPill status={session.status} />
            </div>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {session.name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {session.code} · {session.examType} ·{" "}
              {formatDate(session.startDate)} —{" "}
              {formatDate(session.endDate)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Refresh
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  disabled={
                    busy ||
                    session.status !== "DRAFT"
                  }
                  onClick={() =>
                    onStatus("SCHEDULED")
                  }
                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Publish schedule
                </button>

                <button
                  type="button"
                  disabled={
                    busy ||
                    session.status !== "SCHEDULED"
                  }
                  onClick={() =>
                    onStatus("ONGOING")
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Start examination
                </button>

                <button
                  type="button"
                  disabled={
                    busy ||
                    session.status !== "ONGOING"
                  }
                  onClick={() =>
                    onStatus("COMPLETED")
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Complete session
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OperationalCard
          label="Papers"
          value={session.schedules.length}
          detail="Scheduled papers"
        />

        <OperationalCard
          label="Seated"
          value={session.schedules.reduce(
            (total, item) =>
              total + Number(item.seatCount ?? 0),
            0
          )}
          detail="Seat allocations"
        />

        <OperationalCard
          label="Marks"
          value={session.schedules.reduce(
            (total, item) =>
              total + Number(item.markCount ?? 0),
            0
          )}
          detail="Recorded mark entries"
        />

        <OperationalCard
          label="Rooms"
          value={rooms.length}
          detail="Available exam rooms"
        />
      </div>

      {canManage && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">
                  Paper scheduling
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Schedule a course offering into this examination
                  window.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowScheduleForm(
                    (current) => !current
                  )
                }
                className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"
              >
                {showScheduleForm
                  ? "Close"
                  : "Schedule paper"}
              </button>
            </div>

            {showScheduleForm && (
              <SchedulePaperForm
                busy={busy}
                onSubmit={(body) => {
                  onSchedule(body);
                  setShowScheduleForm(false);
                }}
              />
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">
                  Admit cards
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Generate hall tickets after seating has been
                  allocated. Attendance and overdue fee rules are
                  enforced by the backend.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  busy ||
                  hallTicketBusy ||
                  session.schedules.length === 0
                }
                onClick={() => {
                  setHallTicketBusy(true);

                  try {
                    onHallTickets();
                  } finally {
                    window.setTimeout(
                      () => setHallTicketBusy(false),
                      300
                    );
                  }
                }}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {hallTicketBusy
                  ? "Generating..."
                  : "Generate admit cards"}
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <div className="text-xs font-bold text-slate-700">
                Eligibility workflow
              </div>

              <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <span>1. Schedule papers</span>
                <span>2. Allocate seating</span>
                <span>3. Generate tickets</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              Scheduled papers
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Each paper carries its own seating, marks and
              publication state.
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-400">
            {session.schedules.length} paper(s)
          </span>
        </div>

        {session.schedules.length === 0 ? (
          <EmptyState
            title="No papers scheduled"
            description="Schedule the first course offering for this examination session."
          />
        ) : (
          <div className="mt-5 space-y-3">
            {session.schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                rooms={rooms}
                busy={busy}
                canManage={canManage}
                canApprove={canApprove}
                onSeating={onSeating}
                onOpenMarks={onOpenMarks}
                onLock={onLock}
                onPublish={onPublish}
              />
            ))}
          </div>
        )}
      </section>

      {canManage && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">
                Examination room inventory
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Maintain the rooms available for seating allocation.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowRoomForm(
                  (current) => !current
                )
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
            >
              {showRoomForm
                ? "Close"
                : "Add room"}
            </button>
          </div>

          {showRoomForm && (
            <RoomForm
              busy={busy}
              onSubmit={(body) => {
                onCreateRoom(body);
                setShowRoomForm(false);
              }}
            />
          )}

          {rooms.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="font-bold text-slate-900">
                    {room.name}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {room.code} · {room.capacity} seats
                  </div>

                  {"building" in room &&
                    room.building && (
                      <div className="mt-1 text-xs text-slate-400">
                        {room.building}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}

function OperationalCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <div className="mt-2 text-2xl font-black text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function SchedulePaperForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: {
    courseOfferingId: string;
    examDate: string;
    startTime: string;
    endTime: string;
    maxMarks: number;
    passMarks: number;
  }) => void;
}) {
  const [offering, setOffering] =
    useState<DirectoryOption | null>(null);

  const [form, setForm] = useState({
    examDate: "",
    startTime: "10:00",
    endTime: "13:00",
    maxMarks: "100",
    passMarks: "40",
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    if (!offering) {
      return;
    }

    const maxMarks = Number(form.maxMarks);
    const passMarks = Number(form.passMarks);

    if (
      !Number.isFinite(maxMarks) ||
      !Number.isFinite(passMarks) ||
      maxMarks <= 0 ||
      passMarks < 0 ||
      passMarks > maxMarks
    ) {
      return;
    }

    if (form.endTime <= form.startTime) {
      return;
    }

    onSubmit({
      courseOfferingId: offering.id,
      examDate: form.examDate,
      startTime: form.startTime,
      endTime: form.endTime,
      maxMarks,
      passMarks,
    });

    setOffering(null);

    setForm({
      examDate: "",
      startTime: "10:00",
      endTime: "13:00",
      maxMarks: "100",
      passMarks: "40",
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 space-y-4 border-t border-slate-100 pt-5"
    >
      <EntityPicker
        kind="courseOffering"
        label="Course offering"
        value={offering}
        onChange={setOffering}
        required
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-500">
            Exam date
          </span>

          <input
            required
            type="date"
            value={form.examDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                examDate: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-500">
            Start time
          </span>

          <input
            required
            type="time"
            value={form.startTime}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                startTime: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-500">
            End time
          </span>

          <input
            required
            type="time"
            value={form.endTime}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                endTime: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-500">
            Maximum marks
          </span>

          <input
            required
            type="number"
            min="1"
            value={form.maxMarks}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                maxMarks: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs font-bold text-slate-500">
            Pass marks
          </span>

          <input
            required
            type="number"
            min="0"
            value={form.passMarks}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                passMarks: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={busy || !offering}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Schedule paper
      </button>
    </form>
  );
}

function RoomForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: {
    name: string;
    code: string;
    capacity: number;
  }) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    capacity: "60",
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    const capacity = Number(form.capacity);

    if (
      !form.name.trim() ||
      !form.code.trim() ||
      !Number.isFinite(capacity) ||
      capacity <= 0
    ) {
      return;
    }

    onSubmit({
      name: form.name.trim(),
      code: form.code.trim(),
      capacity,
    });

    setForm({
      name: "",
      code: "",
      capacity: "60",
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"
    >
      <label className="space-y-1">
        <span className="text-xs font-bold text-slate-500">
          Room name
        </span>

        <input
          required
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          placeholder="Room 101"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="space-y-1">
        <span className="text-xs font-bold text-slate-500">
          Room code
        </span>

        <input
          required
          value={form.code}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              code: event.target.value,
            }))
          }
          placeholder="R101"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
        />
      </label>

      <label className="space-y-1">
        <span className="text-xs font-bold text-slate-500">
          Capacity
        </span>

        <input
          required
          type="number"
          min="1"
          value={form.capacity}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              capacity: event.target.value,
            }))
          }
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          Add examination room
        </button>
      </div>
    </form>
  );
}

function ScheduleCard({
  schedule,
  rooms,
  busy,
  canManage,
  canApprove,
  onSeating,
  onOpenMarks,
  onLock,
  onPublish,
}: {
  schedule: ExamSchedule;
  rooms: ExamRoom[];
  busy: boolean;
  canManage: boolean;
  canApprove: boolean;
  onSeating: (
    scheduleId: string,
    roomIds: string[]
  ) => void;
  onOpenMarks: (scheduleId: string) => void;
  onLock: (scheduleId: string) => void;
  onPublish: (scheduleId: string) => void;
}) {
  const [selectedRooms, setSelectedRooms] =
    useState<string[]>([]);

  const canChangeSeating = [
    "DRAFT",
    "PUBLISHED",
  ].includes(schedule.status);

  const selectedCapacity = rooms
    .filter((room) =>
      selectedRooms.includes(room.id)
    )
    .reduce(
      (total, room) =>
        total + Number(room.capacity),
      0
    );

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-slate-950">
              {schedule.courseCode}
            </h4>

            <StatusPill
              status={schedule.status}
            />
          </div>

          <p className="mt-1 text-sm font-medium text-slate-700">
            {schedule.courseName}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              {formatDate(schedule.examDate)}
            </span>

            <span>
              {schedule.startTime} —{" "}
              {schedule.endTime}
            </span>

            <span>
              {schedule.maxMarks} max /{" "}
              {schedule.passMarks} pass
            </span>

            <span>
              {schedule.seatCount ?? 0} seats
            </span>

            <span>
              {schedule.markCount ?? 0} marks
            </span>
          </div>

          {schedule.sectionName && (
            <p className="mt-1 text-xs text-slate-400">
              Section: {schedule.sectionName}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onOpenMarks(schedule.id)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Open marks
          </button>

          {canApprove &&
            schedule.status === "LOCKED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onPublish(schedule.id)
                }
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Publish results
              </button>
            )}

          {canApprove &&
            schedule.status === "PUBLISHED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onLock(schedule.id)
                }
                className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Lock marks
              </button>
            )}
        </div>
      </div>

      {canManage && canChangeSeating && (
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Examination rooms for seating
            </span>

            <select
              multiple
              value={selectedRooms}
              onChange={(event) => {
                const values = Array.from(
                  event.target.selectedOptions
                ).map((option) => option.value);

                setSelectedRooms(values);
              }}
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {rooms.map((room) => (
                <option
                  key={room.id}
                  value={room.id}
                >
                  {room.name} — {room.capacity} seats
                </option>
              ))}
            </select>

            <p className="text-[11px] text-slate-400">
              Hold Cmd/Ctrl to select multiple rooms.
              Selected capacity: {selectedCapacity}.
            </p>
          </label>

          <button
            type="button"
            disabled={
              busy ||
              selectedRooms.length === 0
            }
            onClick={() =>
              onSeating(
                schedule.id,
                selectedRooms
              )
            }
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Allocate seating
          </button>
        </div>
      )}
    </article>
  );
}

function MarksWorkspace({
  sheet,
  draft,
  busy,
  canManage,
  canApprove,
  setDraft,
  onSave,
  onSubmit,
  onApprove,
}: {
  sheet: {
    schedule: ExamSchedule;
    rows: MarksRow[];
  } | null;
  draft: Record<string, string>;
  busy: boolean;
  canManage: boolean;
  canApprove: boolean;
  setDraft: React.Dispatch<
    React.SetStateAction<
      Record<string, string>
    >
  >;
  onSave: () => void;
  onSubmit: () => void;
  onApprove: () => void;
}) {
  if (!sheet) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto max-w-md">
          <div className="text-4xl">📝</div>

          <h2 className="mt-4 text-xl font-black text-slate-950">
            Marks control
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Open a scheduled examination paper from the Sessions &
            schedules tab to enter, submit, approve and lock marks.
          </p>
        </div>
      </section>
    );
  }

  const editable =
    canManage &&
    !["LOCKED", "RESULTS_PUBLISHED"].includes(
      sheet.schedule.status
    );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Marks sheet
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-950">
            {sheet.schedule.courseCode} —{" "}
            {sheet.schedule.courseName}
          </h2>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>
              Maximum:{" "}
              {sheet.schedule.maxMarks}
            </span>

            <span>
              Pass:{" "}
              {sheet.schedule.passMarks}
            </span>

            <StatusPill
              status={sheet.schedule.status}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onSave}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                Save draft
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={onSubmit}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
              >
                Submit for approval
              </button>
            </>
          )}

          {canApprove &&
            sheet.schedule.status ===
              "PUBLISHED" && (
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
              >
                Approve marks
              </button>
            )}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="pb-3 pr-4">
                Student
              </th>

              <th className="pb-3 pr-4">
                Roll number
              </th>

              <th className="pb-3 pr-4">
                Exam attendance
              </th>

              <th className="pb-3 pr-4">
                Marks
              </th>

              <th className="pb-3">
                State
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sheet.rows.map((row) => {
              const value =
                draft[row.studentId] ?? "";

              const valid =
                isValidNumber(value) ||
                value.trim().toUpperCase() ===
                  "AB";

              return (
                <tr key={row.studentId}>
                  <td className="py-3 pr-4">
                    <div className="font-bold text-slate-900">
                      {row.firstName}{" "}
                      {row.lastName}
                    </div>
                  </td>

                  <td className="py-3 pr-4 text-slate-500">
                    {row.rollNumber ?? "—"}
                  </td>

                  <td className="py-3 pr-4 text-slate-500">
                    {row.examAttendance ?? "—"}
                  </td>

                  <td className="py-3 pr-4">
                    {editable ? (
                      <div>
                        <input
                          value={value}
                          disabled={
                            row.status ===
                              "APPROVED" ||
                            row.status ===
                              "PUBLISHED"
                          }
                          onChange={(event) =>
                            setDraft(
                              (current) => ({
                                ...current,
                                [row.studentId]:
                                  event.target
                                    .value,
                              })
                            )
                          }
                          placeholder="0–100 / AB"
                          className={`w-28 rounded-lg border px-3 py-2 text-sm outline-none ${
                            valid
                              ? "border-slate-200"
                              : "border-red-300 bg-red-50"
                          }`}
                        />

                        {!valid && (
                          <p className="mt-1 text-[10px] font-medium text-red-600">
                            Invalid value
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="font-bold text-slate-700">
                        {row.isAbsent
                          ? "AB"
                          : row.marksObtained ??
                            "—"}
                      </span>
                    )}
                  </td>

                  <td className="py-3">
                    <StatusPill
                      status={
                        row.status ??
                        "DRAFT"
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusPill({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusClass(
        status
      )}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <h3 className="font-bold text-slate-800">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}
