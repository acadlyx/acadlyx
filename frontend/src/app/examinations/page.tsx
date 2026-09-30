"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";
import { useRouter } from "next/navigation";

import EntityPicker from "@/components/common/EntityPicker";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  AuthUser,
  getCurrentUser,
} from "@/lib/auth";

import {
  ExamRoom,
  ExamSchedule,
  ExamSession,
  ExamSessionStatus,
  MarksRow,
  allocateSeating,
  approveMarks,
  assignInvigilators,
  createExamRoom,
  createExamSchedule,
  createExamSession,
  generateHallTickets,
  getExamSession,
  getMarksSheet,
  listExamRooms,
  listExamSessions,
  listIncidents,
  listRevaluations,
  lockSchedule,
  publishResults,
  saveMarks,
  setSessionStatus,
} from "@/lib/examinationsApi";

type Tab =
  | "overview"
  | "sessions"
  | "marks"
  | "admit-cards"
  | "revaluations"
  | "incidents";

const SESSION_NEXT: Record<
  string,
  ExamSessionStatus | null
> = {
  DRAFT: "SCHEDULED",
  SCHEDULED: "ONGOING",
  ONGOING: "COMPLETED",
  COMPLETED: "PUBLISHED",
};

function dateLabel(
  value: string | null | undefined,
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
    },
  ).format(date);
}

function dateTimeLabel(
  value: string | null | undefined,
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function statusClass(
  status: string,
) {
  if (
    [
      "PUBLISHED",
      "RESULTS_PUBLISHED",
      "APPROVED",
    ].includes(status)
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (
    [
      "ONGOING",
      "SUBMITTED",
      "LOCKED",
    ].includes(status)
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (
    [
      "CANCELLED",
      "BLOCKED",
      "MALPRACTICE",
      "DEBARRED",
    ].includes(status)
  ) {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function StatusPill({
  value,
}: {
  value: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${statusClass(
        value,
      )}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {hint}
      </p>
    </div>
  );
}

export default function ExaminationsPage() {
  const router = useRouter();

  const [tab, setTab] =
    useState<Tab>("overview");

  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [sessions, setSessions] =
    useState<ExamSession[]>([]);

  const [rooms, setRooms] =
    useState<ExamRoom[]>([]);

  const [activeSession, setActiveSession] =
    useState<
      (ExamSession & {
        schedules: ExamSchedule[];
      }) | null
    >(null);

  const [marksSheet, setMarksSheet] =
    useState<{
      schedule: ExamSchedule;
      rows: MarksRow[];
    } | null>(null);

  const [marksDraft, setMarksDraft] =
    useState<Record<string, string>>({});

  const [revaluations, setRevaluations] =
    useState<Array<Record<string, unknown>>>(
      [],
    );

  const [incidents, setIncidents] =
    useState<Array<Record<string, unknown>>>(
      [],
    );

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [search, setSearch] =
    useState("");

  const canRead =
    Boolean(
      user?.permissions.includes(
        "exams.read",
      ),
    );

  const canManage =
    Boolean(
      user?.permissions.includes(
        "exams.manage",
      ),
    );

  const canApprove =
    Boolean(
      user?.permissions.includes(
        "exams.approve",
      ),
    );

  const loadCore =
    useCallback(async () => {
      const [
        sessionResult,
        roomResult,
      ] = await Promise.all([
        listExamSessions({
          page: 1,
          pageSize: 200,
          search:
            search.trim() ||
            undefined,
        }),
        listExamRooms({
          includeInactive: true,
        }),
      ]);

      setSessions(
        sessionResult.items,
      );

      setRooms(roomResult);
    }, [search]);

  const loadSecondary =
    useCallback(async () => {
      const [
        revaluationResult,
        incidentResult,
      ] = await Promise.all([
        listRevaluations({
          page: 1,
        }),
        listIncidents({
          page: 1,
        }),
      ]);

      setRevaluations(
        revaluationResult.items,
      );

      setIncidents(
        incidentResult.items,
      );
    }, []);

  const reload =
    useCallback(async () => {
      setError("");

      await loadCore();

      if (
        tab === "revaluations" ||
        tab === "incidents"
      ) {
        await loadSecondary();
      }
    }, [
      loadCore,
      loadSecondary,
      tab,
    ]);

  useEffect(() => {
    let alive = true;

    setLoading(true);

    void getCurrentUser()
      .then(async (current) => {
        if (!alive) return;

        setUser(current);

        if (
          !current.permissions.includes(
            "exams.read",
          )
        ) {
          router.replace(
            current.roles.includes(
              "STUDENT",
            )
              ? "/student"
              : "/login",
          );

          return;
        }

        await reload();
      })
      .catch((reason) => {
        if (!alive) return;

        if (
          reason instanceof
          AuthRequiredError
        ) {
          router.replace(
            "/login",
          );

          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load examinations.",
        );
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [reload, router]);

  useEffect(() => {
    if (!user || !canRead) {
      return;
    }

    if (
      tab !== "revaluations" &&
      tab !== "incidents"
    ) {
      return;
    }

    void loadSecondary().catch(
      (reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load examination controls.",
        );
      },
    );
  }, [
    tab,
    user,
    canRead,
    loadSecondary,
  ]);

  const run =
    useCallback(
      async (
        operation: () => Promise<void>,
      ) => {
        setBusy(true);
        setError("");
        setNotice("");

        try {
          await operation();
        } catch (reason) {
          if (
            reason instanceof
            AuthRequiredError
          ) {
            router.replace(
              "/login",
            );

            return;
          }

          setError(
            reason instanceof Error
              ? reason.message
              : "The operation could not be completed.",
          );
        } finally {
          setBusy(false);
        }
      },
      [router],
    );

  const openSession =
    useCallback(
      async (id: string) => {
        await run(async () => {
          setActiveSession(
            await getExamSession(id),
          );
        });
      },
      [run],
    );

  const openMarks =
    useCallback(
      async (scheduleId: string) => {
        await run(async () => {
          const sheet =
            await getMarksSheet(
              scheduleId,
            );

          setMarksSheet(sheet);

          setMarksDraft(
            Object.fromEntries(
              sheet.rows.map(
                (row) => [
                  row.studentId,
                  row.isAbsent
                    ? "AB"
                    : row.marksObtained ==
                        null
                      ? ""
                      : String(
                          row.marksObtained,
                        ),
                ],
              ),
            ),
          );

          setTab("marks");
        });
      },
      [run],
    );

  const summary =
    useMemo(() => {
      const publishedSessions =
        sessions.filter(
          (session) =>
            session.status ===
            "PUBLISHED",
        ).length;

      const liveSessions =
        sessions.filter(
          (session) =>
            session.status ===
            "ONGOING",
        ).length;

      const upcomingSessions =
        sessions.filter(
          (session) =>
            [
              "DRAFT",
              "SCHEDULED",
            ].includes(
              session.status,
            ),
        ).length;

      const activeRooms =
        rooms.filter(
          (room) =>
            room.isActive,
        ).length;

      return {
        publishedSessions,
        liveSessions,
        upcomingSessions,
        activeRooms,
      };
    }, [sessions, rooms]);

  if (loading && !user) {
    return (
      <DashboardShell
        title="Examination Cell"
        subtitle="Examination control room"
      >
        <div className="mx-auto max-w-7xl p-8">
          <div className="h-56 animate-pulse rounded-3xl bg-white" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Examination Cell"
      subtitle="Sessions, scheduling, seating, admit cards, marks and result control"
      allowedRoles={[
        "EXAMINATION",
        "DIRECTOR",
        "INSTITUTION_ADMIN",
      ]}
    >
      <div className="mx-auto max-w-[1500px] space-y-5 pb-12">
        <section className="relative overflow-hidden rounded-[30px] bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-300">
                Examination control room
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-5xl">
                Run the examination lifecycle without losing control.
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Scheduling, seating, hall-ticket generation,
                marks approval and result publication remain
                separately controlled workflows.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canManage && (
                <button
                  type="button"
                  onClick={() =>
                    setTab("sessions")
                  }
                  className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-950"
                >
                  Create / schedule
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  void run(reload)
                }
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-black text-white"
              >
                Refresh data
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                void run(reload)
              }
              className="font-black underline"
            >
              Retry
            </button>
          </div>
        )}

        {notice && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {notice}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Exam sessions"
            value={sessions.length}
            hint={`${summary.upcomingSessions} draft/scheduled`}
          />

          <Metric
            label="Live sessions"
            value={summary.liveSessions}
            hint="Currently ongoing"
          />

          <Metric
            label="Published sessions"
            value={summary.publishedSessions}
            hint="Officially published"
          />

          <Metric
            label="Exam rooms"
            value={summary.activeRooms}
            hint="Active rooms available"
          />

          <Metric
            label="Operational cases"
            value={
              revaluations.length +
              incidents.length
            }
            hint="Revaluation + incident records"
          />
        </section>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {(
            [
              "overview",
              "sessions",
              "marks",
              "admit-cards",
              "revaluations",
              "incidents",
            ] as Tab[]
          ).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() =>
                setTab(item)
              }
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black capitalize ${
                tab === item
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {item.replaceAll(
                "-",
                " ",
              )}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <Overview
            sessions={sessions}
            rooms={rooms}
            activeSession={
              activeSession
            }
            onOpenSession={
              openSession
            }
            onOpenMarks={
              openMarks
            }
          />
        )}

        {tab === "sessions" && (
          <SessionsTab
            sessions={sessions}
            rooms={rooms}
            search={search}
            setSearch={setSearch}
            canManage={canManage}
            canApprove={canApprove}
            busy={busy}
            activeSession={
              activeSession
            }
            onOpenSession={
              openSession
            }
            onOpenMarks={
              openMarks
            }
            onRefresh={() =>
              void reload()
            }
            onRun={run}
            onNotice={setNotice}
            onError={setError}
          />
        )}

        {tab === "marks" && (
          <MarksTab
            sheet={marksSheet}
            draft={marksDraft}
            setDraft={
              setMarksDraft
            }
            canManage={
              canManage
            }
            canApprove={
              canApprove
            }
            busy={busy}
            onSave={(submit) =>
              void run(
                async () => {
                  if (!marksSheet) {
                    return;
                  }

                  const entries =
                    marksSheet.rows.map(
                      (row) => {
                        const raw =
                          (
                            marksDraft[
                              row.studentId
                            ] ?? ""
                          )
                            .trim()
                            .toUpperCase();

                        if (
                          raw === "AB"
                        ) {
                          return {
                            studentId:
                              row.studentId,
                            isAbsent:
                              true,
                            marksObtained:
                              null,
                          };
                        }

                        const number =
                          raw === ""
                            ? null
                            : Number(raw);

                        if (
                          number !== null &&
                          (!Number.isFinite(
                            number,
                          ) ||
                            number < 0 ||
                            number >
                              marksSheet
                                .schedule
                                .maxMarks)
                        ) {
                          throw new Error(
                            `${row.firstName} ${row.lastName}: marks must be between 0 and ${marksSheet.schedule.maxMarks}, or AB.`,
                          );
                        }

                        return {
                          studentId:
                            row.studentId,
                          isAbsent:
                            false,
                          marksObtained:
                            number,
                        };
                      },
                    );

                  await saveMarks(
                    marksSheet
                      .schedule.id,
                    entries,
                    submit,
                  );

                  setNotice(
                    submit
                      ? "Marks submitted for approval."
                      : "Marks saved as draft.",
                  );

                  const refreshed =
                    await getMarksSheet(
                      marksSheet
                        .schedule.id,
                    );

                  setMarksSheet(
                    refreshed,
                  );

                  setMarksDraft(
                    Object.fromEntries(
                      refreshed.rows.map(
                        (row) => [
                          row.studentId,
                          row.isAbsent
                            ? "AB"
                            : row.marksObtained ==
                                null
                              ? ""
                              : String(
                                  row.marksObtained,
                                ),
                        ],
                      ),
                    ),
                  );
                },
              )
            }
            onApprove={() =>
              void run(
                async () => {
                  if (!marksSheet) {
                    return;
                  }

                  await approveMarks(
                    marksSheet
                      .schedule.id,
                  );

                  setNotice(
                    "Marks approved.",
                  );

                  const refreshed =
                    await getMarksSheet(
                      marksSheet
                        .schedule.id,
                    );

                  setMarksSheet(
                    refreshed,
                  );
                },
              )
            }
          />
        )}

        {tab === "admit-cards" && (
          <AdmitCardTab
            sessions={sessions}
            canManage={canManage}
            busy={busy}
            onRun={run}
            onNotice={setNotice}
            onOpenSession={
              openSession
            }
          />
        )}

        {tab === "revaluations" && (
          <CaseTab
            title="Revaluation requests"
            items={revaluations}
            empty="No revaluation requests are currently visible."
          />
        )}

        {tab === "incidents" && (
          <CaseTab
            title="Examination incidents"
            items={incidents}
            empty="No examination incidents are currently visible."
          />
        )}
      </div>
    </DashboardShell>
  );
}

function Overview({
  sessions,
  rooms,
  activeSession,
  onOpenSession,
  onOpenMarks,
}: {
  sessions: ExamSession[];
  rooms: ExamRoom[];
  activeSession:
    | (ExamSession & {
        schedules: ExamSchedule[];
      })
    | null;
  onOpenSession: (
    id: string,
  ) => void;
  onOpenMarks: (
    id: string,
  ) => void;
}) {
  const next =
    sessions
      .filter((session) =>
        [
          "SCHEDULED",
          "ONGOING",
        ].includes(
          session.status,
        ),
      )
      .slice(0, 5);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              Operational queue
            </p>

            <h2 className="mt-1 text-xl font-black">
              Upcoming / live examinations
            </h2>
          </div>

          <span className="text-xs text-slate-400">
            {next.length} shown
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {next.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              No scheduled or live sessions are currently visible.
            </p>
          ) : (
            next.map(
              (session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() =>
                    onOpenSession(
                      session.id,
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-200 hover:bg-blue-50/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {session.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {session.code} ·{" "}
                        {session.examType} ·{" "}
                        {dateLabel(
                          session.startDate,
                        )}{" "}
                        —{" "}
                        {dateLabel(
                          session.endDate,
                        )}
                      </p>
                    </div>

                    <StatusPill
                      value={
                        session.status
                      }
                    />
                  </div>
                </button>
              ),
            )
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
          Infrastructure
        </p>

        <h2 className="mt-1 text-xl font-black">
          Room readiness
        </h2>

        <div className="mt-5 space-y-2">
          {rooms
            .slice(0, 8)
            .map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
              >
                <div>
                  <p className="text-xs font-black">
                    {room.name}
                  </p>

                  <p className="text-[10px] text-slate-500">
                    {room.code} · capacity{" "}
                    {room.capacity}
                  </p>
                </div>

                <span
                  className={`text-[10px] font-black ${
                    room.isActive
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {room.isActive
                    ? "ACTIVE"
                    : "INACTIVE"}
                </span>
              </div>
            ))}

          {rooms.length === 0 && (
            <p className="text-sm text-slate-500">
              No examination rooms configured.
            </p>
          )}
        </div>

        {activeSession && (
          <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Open session
            </p>

            <p className="mt-1 font-black">
              {activeSession.name}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {
                activeSession
                  .schedules.length
              }{" "}
              scheduled paper(s)
            </p>

            <button
              type="button"
              disabled={
                !activeSession
                  .schedules[0]
              }
              onClick={() => {
                const schedule =
                  activeSession
                    .schedules[0];

                if (schedule) {
                  onOpenMarks(
                    schedule.id,
                  );
                }
              }}
              className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
            >
              Open first marks sheet
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function SessionsTab({
  sessions,
  rooms,
  search,
  setSearch,
  canManage,
  canApprove,
  busy,
  activeSession,
  onOpenSession,
  onOpenMarks,
  onRefresh,
  onRun,
  onNotice,
  onError,
}: {
  sessions: ExamSession[];
  rooms: ExamRoom[];
  search: string;
  setSearch: (
    value: string,
  ) => void;
  canManage: boolean;
  canApprove: boolean;
  busy: boolean;
  activeSession:
    | (ExamSession & {
        schedules: ExamSchedule[];
      })
    | null;
  onOpenSession: (
    id: string,
  ) => void;
  onOpenMarks: (
    id: string,
  ) => void;
  onRefresh: () => void;
  onRun: (
    fn: () => Promise<void>,
  ) => Promise<void>;
  onNotice: (
    value: string,
  ) => void;
  onError: (
    value: string,
  ) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value,
            )
          }
          placeholder="Search session name or code"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />

        <button
          type="button"
          onClick={onRefresh}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black"
        >
          Refresh
        </button>
      </div>

      {canManage && (
        <CreateSessionForm
          busy={busy}
          onCreate={(body) =>
            void onRun(
              async () => {
                await createExamSession(
                  body,
                );

                onNotice(
                  "Examination session created in DRAFT state.",
                );

                onRefresh();
              },
            )
          }
        />
      )}

      {canManage && (
        <RoomForm
          busy={busy}
          onCreate={(body) =>
            void onRun(
              async () => {
                await createExamRoom(
                  body,
                );

                onNotice(
                  "Examination room created.",
                );

                onRefresh();
              },
            )
          }
        />
      )}

      {activeSession && (
        <SessionWorkspace
          session={
            activeSession
          }
          rooms={rooms}
          canManage={
            canManage
          }
          canApprove={
            canApprove
          }
          busy={busy}
          onOpenMarks={
            onOpenMarks
          }
          onRefresh={
            onRefresh
          }
          onRun={onRun}
          onNotice={onNotice}
          onError={onError}
        />
      )}

      {sessions.length === 0 ? (
        <Empty
          title="No examination sessions"
          description="Create the master examination session before scheduling papers."
        />
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-black">
              Examination sessions
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Open a session to manage its papers,
              seating and lifecycle.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">
                    Session
                  </th>
                  <th className="px-5 py-3">
                    Type
                  </th>
                  <th className="px-5 py-3">
                    Window
                  </th>
                  <th className="px-5 py-3">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {sessions.map(
                  (session) => (
                    <tr
                      key={session.id}
                    >
                      <td className="px-5 py-4">
                        <p className="font-black">
                          {session.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {session.code}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600">
                        {session.examType}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600">
                        {dateLabel(
                          session.startDate,
                        )}{" "}
                        —{" "}
                        {dateLabel(
                          session.endDate,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <StatusPill
                          value={
                            session.status
                          }
                        />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenSession(
                              session.id,
                            )
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function CreateSessionForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (body: {
    name: string;
    code: string;
    examType:
      | "REGULAR"
      | "SUPPLEMENTARY"
      | "REVALUATION"
      | "IMPROVEMENT";
    startDate: string;
    endDate: string;
    hallTicketReleaseAt?: string;
    instructions?: string;
  }) => void;
}) {
  const [form, setForm] =
    useState({
      name: "",
      code: "",
      examType:
        "REGULAR" as const,
      startDate: "",
      endDate: "",
      hallTicketReleaseAt: "",
      instructions: "",
    });

  function submit(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (
      !form.name ||
      !form.code ||
      !form.startDate ||
      !form.endDate
    ) {
      return;
    }

    if (
      new Date(form.endDate) <
      new Date(form.startDate)
    ) {
      window.alert(
        "End date cannot be before start date.",
      );

      return;
    }

    onCreate({
      ...form,
      hallTicketReleaseAt:
        form.hallTicketReleaseAt ||
        undefined,
      instructions:
        form.instructions ||
        undefined,
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
        Session setup
      </p>

      <h2 className="mt-1 text-xl font-black">
        Create master examination session
      </h2>

      <p className="mt-1 text-xs text-slate-500">
        Every new session starts in DRAFT.
        Official status transitions remain controlled.
      </p>

      <form
        onSubmit={submit}
        className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <Field label="Name">
          <input
            required
            value={form.name}
            onChange={(event) =>
              setForm({
                ...form,
                name: event.target.value,
              })
            }
            placeholder="End Semester Examination 2026"
            className="input"
          />
        </Field>

        <Field label="Code">
          <input
            required
            value={form.code}
            onChange={(event) =>
              setForm({
                ...form,
                code: event.target.value,
              })
            }
            placeholder="ESE_2026"
            className="input"
          />
        </Field>

        <Field label="Exam type">
          <select
            value={form.examType}
            onChange={(event) =>
              setForm({
                ...form,
                examType:
                  event.target
                    .value as typeof form.examType,
              })
            }
            className="input"
          >
            <option value="REGULAR">
              Regular
            </option>

            <option value="SUPPLEMENTARY">
              Supplementary
            </option>

            <option value="REVALUATION">
              Revaluation
            </option>

            <option value="IMPROVEMENT">
              Improvement
            </option>
          </select>
        </Field>

        <Field label="Starts">
          <input
            required
            type="datetime-local"
            value={form.startDate}
            onChange={(event) =>
              setForm({
                ...form,
                startDate:
                  event.target.value,
              })
            }
            className="input"
          />
        </Field>

        <Field label="Ends">
          <input
            required
            type="datetime-local"
            value={form.endDate}
            onChange={(event) =>
              setForm({
                ...form,
                endDate:
                  event.target.value,
              })
            }
            className="input"
          />
        </Field>

        <Field label="Hall-ticket release">
          <input
            type="datetime-local"
            value={
              form.hallTicketReleaseAt
            }
            onChange={(event) =>
              setForm({
                ...form,
                hallTicketReleaseAt:
                  event.target.value,
              })
            }
            className="input"
          />
        </Field>

        <Field label="Instructions">
          <textarea
            value={form.instructions}
            onChange={(event) =>
              setForm({
                ...form,
                instructions:
                  event.target.value,
              })
            }
            rows={3}
            className="input md:col-span-2 xl:col-span-3"
          />
        </Field>

        <div>
          <button
            disabled={busy}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50"
          >
            {busy
              ? "Creating…"
              : "Create session"}
          </button>
        </div>
      </form>
    </section>
  );
}

function RoomForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (body: {
    name: string;
    code: string;
    capacity: number;
    building?: string;
    floor?: string;
  }) => void;
}) {
  const [form, setForm] =
    useState({
      name: "",
      code: "",
      capacity: "60",
      building: "",
      floor: "",
    });

  function submit(
    event: FormEvent,
  ) {
    event.preventDefault();

    const capacity =
      Number(form.capacity);

    if (
      !form.name ||
      !form.code ||
      !Number.isInteger(
        capacity,
      ) ||
      capacity < 1
    ) {
      return;
    }

    onCreate({
      name: form.name,
      code: form.code,
      capacity,
      building:
        form.building ||
        undefined,
      floor:
        form.floor ||
        undefined,
    });

    setForm({
      name: "",
      code: "",
      capacity: "60",
      building: "",
      floor: "",
    });
  }

  return (
    <details className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer p-6 text-sm font-black">
        Add examination room
      </summary>

      <form
        onSubmit={submit}
        className="grid gap-4 border-t border-slate-100 p-6 md:grid-cols-2 xl:grid-cols-5"
      >
        <Field label="Room">
          <input
            required
            value={form.name}
            onChange={(event) =>
              setForm({
                ...form,
                name: event.target.value,
              })
            }
            className="input"
          />
        </Field>

        <Field label="Code">
          <input
            required
            value={form.code}
            onChange={(event) =>
              setForm({
                ...form,
                code: event.target.value,
              })
            }
            className="input"
          />
        </Field>

        <Field label="Capacity">
          <input
            required
            type="number"
            min={1}
            value={form.capacity}
            onChange={(event) =>
              setForm({
                ...form,
                capacity:
                  event.target.value,
              })
            }
            className="input"
          />
        </Field>

        <Field label="Building">
          <input
            value={form.building}
            onChange={(event) =>
              setForm({
                ...form,
                building:
                  event.target.value,
              })
            }
            className="input"
          />
        </Field>

        <Field label="Floor">
          <input
            value={form.floor}
            onChange={(event) =>
              setForm({
                ...form,
                floor:
                  event.target.value,
              })
            }
            className="input"
          />
        </Field>

        <div>
          <button
            disabled={busy}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white"
          >
            Create room
          </button>
        </div>
      </form>
    </details>
  );
}

function SessionWorkspace({
  session,
  rooms,
  canManage,
  canApprove,
  busy,
  onOpenMarks,
  onRefresh,
  onRun,
  onNotice,
  onError,
}: {
  session: ExamSession & {
    schedules: ExamSchedule[];
  };
  rooms: ExamRoom[];
  canManage: boolean;
  canApprove: boolean;
  busy: boolean;
  onOpenMarks: (
    id: string,
  ) => void;
  onRefresh: () => void;
  onRun: (
    fn: () => Promise<void>,
  ) => Promise<void>;
  onNotice: (
    value: string,
  ) => void;
  onError: (
    value: string,
  ) => void;
}) {
  const [
    courseOfferingId,
    setCourseOfferingId,
  ] = useState("");

  const [
    examDate,
    setExamDate,
  ] = useState("");

  const [
    startTime,
    setStartTime,
  ] = useState("09:00");

  const [
    endTime,
    setEndTime,
  ] = useState("12:00");

  const [
    maxMarks,
    setMaxMarks,
  ] = useState("100");

  const [
    passMarks,
    setPassMarks,
  ] = useState("40");

  const nextStatus =
    SESSION_NEXT[
      session.status
    ] || null;

  async function createSchedule(
    event: FormEvent,
  ) {
    event.preventDefault();

    const max =
      Number(maxMarks);

    const pass =
      Number(passMarks);

    if (
      !courseOfferingId ||
      !examDate ||
      !Number.isFinite(max) ||
      !Number.isFinite(pass) ||
      pass > max ||
      endTime <= startTime
    ) {
      onError(
        "Check course offering, date, time and marks. Pass marks cannot exceed maximum marks.",
      );

      return;
    }

    await onRun(
      async () => {
        await createExamSchedule({
          examSessionId:
            session.id,
          courseOfferingId,
          examDate,
          startTime,
          endTime,
          maxMarks: max,
          passMarks: pass,
        });

        onNotice(
          "Examination paper created in DRAFT state.",
        );

        setCourseOfferingId("");

        onRefresh();
      },
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
            Selected session
          </p>

          <h2 className="mt-1 text-2xl font-black">
            {session.name}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {session.code} ·{" "}
            {session.examType} ·{" "}
            {dateLabel(
              session.startDate,
            )}{" "}
            —{" "}
            {dateLabel(
              session.endDate,
            )}
          </p>

          {session.hallTicketReleaseAt && (
            <p className="mt-1 text-xs text-slate-500">
              Hall-ticket release:{" "}
              {dateTimeLabel(
                session.hallTicketReleaseAt,
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill
            value={session.status}
          />

          {canApprove &&
            nextStatus && (
              <button
                disabled={busy}
                type="button"
                onClick={() =>
                  void onRun(
                    async () => {
                      await setSessionStatus(
                        session.id,
                        nextStatus,
                      );

                      onNotice(
                        `Session moved to ${nextStatus.replaceAll(
                          "_",
                          " ",
                        )}.`,
                      );

                      onRefresh();
                    },
                  )
                }
                className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
              >
                Move to{" "}
                {nextStatus.replaceAll(
                  "_",
                  " ",
                )}
              </button>
            )}
        </div>
      </div>

      {canManage && (
        <form
          onSubmit={
            createSchedule
          }
          className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <Field label="Course offering">
            <EntityPicker
              label=""
              value={
                courseOfferingId
              }
              onChange={
                setCourseOfferingId
              }
              entity="course-offering"
            />
          </Field>

          <Field label="Exam date">
            <input
              required
              type="date"
              value={examDate}
              onChange={(event) =>
                setExamDate(
                  event.target
                    .value,
                )
              }
              className="input"
            />
          </Field>

          <Field label="Start">
            <input
              required
              type="time"
              value={startTime}
              onChange={(event) =>
                setStartTime(
                  event.target
                    .value,
                )
              }
              className="input"
            />
          </Field>

          <Field label="End">
            <input
              required
              type="time"
              value={endTime}
              onChange={(event) =>
                setEndTime(
                  event.target
                    .value,
                )
              }
              className="input"
            />
          </Field>

          <Field label="Maximum marks">
            <input
              required
              type="number"
              min={1}
              value={maxMarks}
              onChange={(event) =>
                setMaxMarks(
                  event.target
                    .value,
                )
              }
              className="input"
            />
          </Field>

          <Field label="Pass marks">
            <input
              required
              type="number"
              min={0}
              value={passMarks}
              onChange={(event) =>
                setPassMarks(
                  event.target
                    .value,
                )
              }
              className="input"
            />
          </Field>

          <div className="flex items-end md:col-span-2">
            <button
              disabled={busy}
              className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"
            >
              Add examination paper
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
            <tr>
              <th className="pb-3">
                Paper
              </th>

              <th className="pb-3">
                Date / time
              </th>

              <th className="pb-3">
                Seats
              </th>

              <th className="pb-3">
                Marks
              </th>

              <th className="pb-3">
                Status
              </th>

              <th className="pb-3 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {session.schedules.map(
              (schedule) => (
                <ScheduleRow
                  key={schedule.id}
                  schedule={schedule}
                  rooms={rooms}
                  canManage={
                    canManage
                  }
                  canApprove={
                    canApprove
                  }
                  busy={busy}
                  onOpenMarks={
                    onOpenMarks
                  }
                  onRun={onRun}
                  onNotice={
                    onNotice
                  }
                  onRefresh={
                    onRefresh
                  }
                />
              ),
            )}
          </tbody>
        </table>

        {session.schedules
          .length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            No papers scheduled in this session.
          </p>
        )}
      </div>
    </section>
  );
}

function ScheduleRow({
  schedule,
  rooms,
  canManage,
  canApprove,
  busy,
  onOpenMarks,
  onRun,
  onNotice,
  onRefresh,
}: {
  schedule: ExamSchedule;
  rooms: ExamRoom[];
  canManage: boolean;
  canApprove: boolean;
  busy: boolean;
  onOpenMarks: (
    id: string,
  ) => void;
  onRun: (
    fn: () => Promise<void>,
  ) => Promise<void>;
  onNotice: (
    value: string,
  ) => void;
  onRefresh: () => void;
}) {
  const [
    roomId,
    setRoomId,
  ] = useState("");

  const [
    facultyId,
    setFacultyId,
  ] = useState("");

  return (
    <tr>
      <td className="py-4 pr-4">
        <p className="font-black">
          {schedule.courseCode} ·{" "}
          {schedule.courseName}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {schedule.sectionName ||
            "Section not set"}
        </p>
      </td>

      <td className="py-4 pr-4 text-xs text-slate-600">
        {dateLabel(
          schedule.examDate,
        )}
        <br />
        {schedule.startTime} —{" "}
        {schedule.endTime}
      </td>

      <td className="py-4 pr-4 text-xs font-semibold">
        {schedule.seatCount}
      </td>

      <td className="py-4 pr-4 text-xs">
        {schedule.markCount} entered /{" "}
        {schedule.maxMarks}
      </td>

      <td className="py-4 pr-4">
        <StatusPill
          value={schedule.status}
        />
      </td>

      <td className="py-4 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              onOpenMarks(
                schedule.id,
              )
            }
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-black"
          >
            Marks
          </button>

          {canManage && (
            <>
              <select
                value={roomId}
                onChange={(event) =>
                  setRoomId(
                    event.target
                      .value,
                  )
                }
                className="max-w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px]"
              >
                <option value="">
                  Seat room
                </option>

                {rooms
                  .filter(
                    (room) =>
                      room.isActive,
                  )
                  .map(
                    (room) => (
                      <option
                        key={
                          room.id
                        }
                        value={
                          room.id
                        }
                      >
                        {room.code} ·{" "}
                        {
                          room.capacity
                        }
                      </option>
                    ),
                  )}
              </select>

              <button
                type="button"
                disabled={
                  busy ||
                  !roomId
                }
                onClick={() =>
                  void onRun(
                    async () => {
                      const result =
                        await allocateSeating(
                          schedule.id,
                          [
                            roomId,
                          ],
                        );

                      onNotice(
                        `${result.seated} candidate(s) seated.`,
                      );

                      onRefresh();
                    },
                  )
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-black disabled:opacity-40"
              >
                Seat
              </button>

              <EntityPicker
                label=""
                value={facultyId}
                onChange={
                  setFacultyId
                }
                entity="user"
              />

              <button
                type="button"
                disabled={
                  busy ||
                  !roomId ||
                  !facultyId
                }
                onClick={() =>
                  void onRun(
                    async () => {
                      const result =
                        await assignInvigilators(
                          schedule.id,
                          [
                            {
                              facultyId,
                              examRoomId:
                                roomId,
                              dutyRole:
                                "INVIGILATOR",
                            },
                          ],
                        );

                      onNotice(
                        `${result.assigned} invigilator assignment(s) saved.`,
                      );

                      onRefresh();
                    },
                  )
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-black disabled:opacity-40"
              >
                Invigilator
              </button>
            </>
          )}

          {canApprove &&
            schedule.status ===
              "PUBLISHED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRun(
                    async () => {
                      await lockSchedule(
                        schedule.id,
                      );

                      onNotice(
                        "Schedule locked. Marks can no longer be edited.",
                      );

                      onRefresh();
                    },
                  )
                }
                className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-black text-white"
              >
                Lock
              </button>
            )}

          {canApprove &&
            schedule.status ===
              "LOCKED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRun(
                    async () => {
                      await publishResults(
                        schedule.id,
                      );

                      onNotice(
                        "Results published.",
                      );

                      onRefresh();
                    },
                  )
                }
                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white"
              >
                Publish
              </button>
            )}
        </div>
      </td>
    </tr>
  );
}

function MarksTab({
  sheet,
  draft,
  setDraft,
  canManage,
  canApprove,
  busy,
  onSave,
  onApprove,
}: {
  sheet: {
    schedule: ExamSchedule;
    rows: MarksRow[];
  } | null;

  draft: Record<string, string>;

  setDraft: Dispatch<
    SetStateAction<
      Record<string, string>
    >
  >;

  canManage: boolean;
  canApprove: boolean;
  busy: boolean;

  onSave: (
    submit: boolean,
  ) => void;

  onApprove: () => void;
}) {
  if (!sheet) {
    return (
      <Empty
        title="No marks sheet selected"
        description="Open a paper from Sessions and schedules to enter or review marks."
      />
    );
  }

  const submitted =
    sheet.rows.filter(
      (row) =>
        row.status ===
        "SUBMITTED",
    ).length;

  const approved =
    sheet.rows.filter(
      (row) =>
        row.status ===
        "APPROVED",
    ).length;

  const incomplete =
    sheet.rows.filter(
      (row) =>
        !row.isAbsent &&
        row.marksObtained ==
          null,
    ).length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
            Marks control
          </p>

          <h2 className="mt-1 text-2xl font-black">
            {sheet.schedule.courseCode}{" "}
            ·{" "}
            {sheet.schedule.courseName}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {dateLabel(
              sheet.schedule.examDate,
            )}{" "}
            · Maximum{" "}
            {sheet.schedule.maxMarks}{" "}
            · Pass{" "}
            {sheet.schedule.passMarks}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Metric
            label="Submitted"
            value={submitted}
            hint="Awaiting approval"
          />

          <Metric
            label="Approved"
            value={approved}
            hint="Approved entries"
          />

          <Metric
            label="Incomplete"
            value={incomplete}
            hint="Needs entry"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {canManage && (
          <>
            <button
              disabled={
                busy ||
                sheet.schedule
                  .status ===
                  "LOCKED" ||
                sheet.schedule
                  .status ===
                  "RESULTS_PUBLISHED"
              }
              type="button"
              onClick={() =>
                onSave(false)
              }
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black disabled:opacity-40"
            >
              Save draft
            </button>

            <button
              disabled={
                busy ||
                incomplete > 0 ||
                sheet.schedule
                  .status ===
                  "LOCKED" ||
                sheet.schedule
                  .status ===
                  "RESULTS_PUBLISHED"
              }
              type="button"
              onClick={() =>
                onSave(true)
              }
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"
            >
              Submit for approval
            </button>
          </>
        )}

        {canApprove &&
          submitted > 0 && (
            <button
              disabled={busy}
              type="button"
              onClick={
                onApprove
              }
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"
            >
              Approve submitted marks
            </button>
          )}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
            <tr>
              <th className="pb-3">
                Student
              </th>

              <th className="pb-3">
                Roll
              </th>

              <th className="pb-3">
                Exam attendance
              </th>

              <th className="pb-3">
                Marks
              </th>

              <th className="pb-3">
                Workflow
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sheet.rows.map(
              (row) => (
                <tr
                  key={
                    row.studentId
                  }
                >
                  <td className="py-3 font-semibold">
                    {row.firstName}{" "}
                    {row.lastName}
                  </td>

                  <td className="py-3 text-xs text-slate-500">
                    {row.rollNumber ||
                      "—"}
                  </td>

                  <td className="py-3 text-xs">
                    {row.examAttendance ||
                      "Not recorded"}
                  </td>

                  <td className="py-3">
                    {canManage &&
                    ![
                      "APPROVED",
                      "PUBLISHED",
                    ].includes(
                      row.status,
                    ) ? (
                      <input
                        value={
                          draft[
                            row
                              .studentId
                          ] || ""
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraft(
                            (
                              current,
                            ) => ({
                              ...current,
                              [row.studentId]:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                        placeholder="0–max / AB"
                        className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      />
                    ) : (
                      <span className="font-black">
                        {row.isAbsent
                          ? "AB"
                          : row.marksObtained ??
                            "—"}
                      </span>
                    )}
                  </td>

                  <td className="py-3">
                    <StatusPill
                      value={
                        row.status
                      }
                    />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdmitCardTab({
  sessions,
  canManage,
  busy,
  onRun,
  onNotice,
  onOpenSession,
}: {
  sessions: ExamSession[];
  canManage: boolean;
  busy: boolean;
  onRun: (
    fn: () => Promise<void>,
  ) => Promise<void>;
  onNotice: (
    value: string,
  ) => void;
  onOpenSession: (
    id: string,
  ) => void;
}) {
  const eligible =
    sessions.filter(
      (session) =>
        ![
          "DRAFT",
          "CANCELLED",
        ].includes(
          session.status,
        ),
    );

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-3">
        {eligible.length === 0 ? (
          <Empty
            title="No session is ready for admit cards"
            description="A session must be scheduled before hall tickets can be generated."
          />
        ) : (
          eligible.map(
            (session) => (
              <article
                key={session.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                      Hall-ticket control
                    </p>

                    <h2 className="mt-1 text-lg font-black">
                      {session.name}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      {session.code} · release{" "}
                      {dateTimeLabel(
                        session.hallTicketReleaseAt,
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      value={
                        session.status
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        onOpenSession(
                          session.id,
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                    >
                      Open session
                    </button>

                    {canManage && (
                      <button
                        disabled={busy}
                        type="button"
                        onClick={() =>
                          void onRun(
                            async () => {
                              const result =
                                await generateHallTickets(
                                  session.id,
                                );

                              onNotice(
                                `Hall tickets processed: ${result.issued} issued, ${result.blocked} blocked.`,
                              );
                            },
                          )
                        }
                        className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                      >
                        Generate / refresh
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Release gate
                    </p>

                    <p className="mt-1 text-sm font-black">
                      {session.hallTicketReleaseAt
                        ? dateTimeLabel(
                            session.hallTicketReleaseAt,
                          )
                        : "No future release time"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Session status
                    </p>

                    <p className="mt-1 text-sm font-black">
                      {session.status}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Eligibility checks
                    </p>

                    <p className="mt-1 text-sm font-black">
                      Attendance + fees
                    </p>
                  </div>
                </div>
              </article>
            ),
          )
        )}
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">
          Publication rule
        </p>

        <h2 className="mt-2 text-2xl font-black">
          Generated does not mean released.
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          The backend blocks student access before
          the configured release time. Hall-ticket
          generation also evaluates attendance and
          overdue fee policy and records blocked
          candidates instead of silently dropping them.
        </p>
      </aside>
    </div>
  );
}

function CaseTab({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<Record<string, unknown>>;
  empty: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black">
        {title}
      </h2>

      <p className="mt-1 text-xs text-slate-500">
        Operational records returned by the examination service.
      </p>

      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="pb-3">
                  Student
                </th>

                <th className="pb-3">
                  Course
                </th>

                <th className="pb-3">
                  Status
                </th>

                <th className="pb-3">
                  Date
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {items.map(
                (item, index) => (
                  <tr
                    key={String(
                      item.id ||
                        index,
                    )}
                  >
                    <td className="py-3 font-semibold">
                      {String(
                        item.studentName ||
                          item.studentId ||
                          "—",
                      )}
                    </td>

                    <td className="py-3 text-xs text-slate-500">
                      {String(
                        item.courseCode ||
                          "—",
                      )}
                    </td>

                    <td className="py-3">
                      <StatusPill
                        value={String(
                          item.status ||
                            "UNKNOWN",
                        )}
                      />
                    </td>

                    <td className="py-3 text-xs text-slate-500">
                      {dateLabel(
                        String(
                          item.createdAt ||
                            item.requestedAt ||
                            "",
                        ),
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>

      {children}
    </label>
  );
}

function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="text-lg font-black">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
        {description}
      </p>
    </section>
  );
}
