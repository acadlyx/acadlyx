"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import EntityPicker from "@/components/common/EntityPicker";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
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

/**
 * Examinations workspace.
 *
 * Follows the real backend workflow rather than a generic CRUD screen:
 * a session is created, papers are scheduled against course offerings,
 * seating and hall tickets are generated, marks are entered, submitted,
 * approved by a second person, locked, and finally published into the
 * existing grading pipeline.
 */

type Tab = "sessions" | "marks";

const MANAGE_ROLES = [
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "EXAMINATION",
];

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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = roles.some((role) => MANAGE_ROLES.includes(role));
  const canApprove = roles.some((role) =>
    ["INSTITUTION_ADMIN", "DIRECTOR", "EXAMINATION"].includes(role)
  );

  /** Wraps every mutation so errors surface instead of failing silently. */
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
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const reload = useCallback(async () => {
    const [sessionList, roomList] = await Promise.all([
      listExamSessions({ page: 1 }),
      listExamRooms().catch(() => [] as ExamRoom[]),
    ]);

    setSessions(sessionList.items);
    setRooms(roomList);
  }, []);

  useEffect(() => {
    void run(async () => {
      const user = await getCurrentUser();
      setRoles(user?.roles ?? []);
      await reload();
    });
  }, [run, reload]);

  async function openSession(id: string) {
    await run(async () => {
      setActive(await getExamSession(id));
      setSheet(null);
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
            row.isAbsent ? "AB" : row.marksObtained?.toString() ?? "",
          ])
        )
      );

      setTab("marks");
    });
  }

  function marksPayload() {
    if (!sheet) return [];

    return sheet.rows.map((row) => {
      const raw = (draft[row.studentId] ?? "").trim().toUpperCase();

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
        marksObtained: raw === "" ? null : Number(raw),
      };
    });
  }

  return (
    <DashboardShell
      title="Examinations"
      subtitle="Sessions, seating, hall tickets, marks approval and publication"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex gap-2">
          {(["sessions", "marks"] as Tab[]).map((key) => (
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
              {key === "sessions" ? "Sessions & schedules" : "Marks entry"}
            </button>
          ))}
        </div>

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

        {tab === "sessions" && (
          <>
            {canManage && (
              <NewSessionForm
                busy={busy}
                onCreate={(body) =>
                  run(async () => {
                    const created = await createExamSession(body);
                    setNotice(`Created ${created.name}`);
                    await reload();
                  })
                }
              />
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Examination sessions
              </h2>

              {sessions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No examination sessions yet.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="pb-2">Session</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Window</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {sessions.map((session) => (
                        <tr key={session.id}>
                          <td className="py-2 font-semibold text-slate-900">
                            {session.name}
                          </td>

                          <td className="py-2 text-slate-600">
                            {session.examType}
                          </td>

                          <td className="py-2 text-slate-600">
                            {new Date(
                              session.startDate
                            ).toLocaleDateString()}{" "}
                            —{" "}
                            {new Date(
                              session.endDate
                            ).toLocaleDateString()}
                          </td>

                          <td className="py-2">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                              {session.status}
                            </span>
                          </td>

                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void openSession(session.id)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                            >
                              Open
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
                onRefresh={() => void openSession(active.id)}
                onOpenMarks={openMarks}
                onRun={run}
                onNotice={setNotice}
                onError={setError}
              />
            )}
          </>
        )}

        {tab === "marks" && (
          <MarksWorkspace
            sheet={sheet}
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            canManage={canManage}
            canApprove={canApprove}
            onSave={() =>
              run(async () => {
                if (!sheet) return;

                await saveMarks(
                  sheet.schedule.id,
                  marksPayload()
                );

                setNotice("Marks saved successfully.");
                await openMarks(sheet.schedule.id);
              })
            }
            onApprove={() =>
              run(async () => {
                if (!sheet) return;

                await approveMarks(
                  sheet.schedule.id
                );

                setNotice("Marks approved successfully.");
                await openMarks(sheet.schedule.id);
              })
            }
          />
        )}
      </div>
    </DashboardShell>
  );
}

function NewSessionForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (body: {
    name: string;
    examType: string;
    startsAt: string;
    endsAt: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [examType, setExamType] = useState("END_SEMESTER");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();

    onCreate({
      name: name.trim(),
      examType,
      startsAt,
      endsAt,
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">
          Create examination session
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Create the master examination window before scheduling individual
          papers.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Session name
          </span>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="End Semester Examination 2026"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Type
          </span>

          <select
            value={examType}
            onChange={(event) => setExamType(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="END_SEMESTER">End Semester</option>
            <option value="MID_SEMESTER">Mid Semester</option>
            <option value="INTERNAL">Internal</option>
            <option value="SUPPLEMENTARY">Supplementary</option>
            <option value="BACKLOG">Backlog</option>
            <option value="ENTRANCE">Entrance</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Starts
          </span>

          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ends
          </span>

          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <div className="md:col-span-2 xl:col-span-4">
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Creating..." : "Create examination session"}
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
  onOpenMarks,
  onRun,
  onNotice,
  onError,
}: {
  session: ExamSession & { schedules: ExamSchedule[] };
  rooms: ExamRoom[];
  busy: boolean;
  canManage: boolean;
  canApprove: boolean;
  onRefresh: () => void;
  onOpenMarks: (scheduleId: string) => void;
  onRun: (
    fn: () => Promise<void>
  ) => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [courseOfferingId, setCourseOfferingId] =
    useState("");
  const [scheduledAt, setScheduledAt] =
    useState("");
  const [durationMinutes, setDurationMinutes] =
    useState("180");
  const [maxMarks, setMaxMarks] =
    useState("100");
  const [roomId, setRoomId] =
    useState("");
  const [capacity, setCapacity] =
    useState("60");
  const [roomName, setRoomName] =
    useState("");
  const [building, setBuilding] =
    useState("");
  const [floor, setFloor] =
    useState("");

  async function createSchedule(
    event: FormEvent
  ) {
    event.preventDefault();

    await onRun(async () => {
      await createExamSchedule({
        sessionId: session.id,
        courseOfferingId,
        scheduledAt,
        durationMinutes: Number(
          durationMinutes
        ),
        maxMarks: Number(maxMarks),
        roomId: roomId || undefined,
      });

      onNotice(
        "Examination paper scheduled successfully."
      );

      onRefresh();
    });
  }

  async function createRoom(
    event: FormEvent
  ) {
    event.preventDefault();

    await onRun(async () => {
      await createExamRoom({
        name: roomName.trim(),
        building: building.trim(),
        floor: floor.trim(),
        capacity: Number(capacity),
      });

      setRoomName("");
      setBuilding("");
      setFloor("");
      setCapacity("60");

      onNotice(
        "Examination room created successfully."
      );

      onRefresh();
    });
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Active session
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              {session.name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {session.examType} · {session.status}
            </p>
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              {session.status === "DRAFT" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void onRun(async () => {
                      await setSessionStatus(
                        session.id,
                        "SCHEDULED"
                      );

                      onNotice(
                        "Session moved to scheduled."
                      );

                      onRefresh();
                    })
                  }
                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Publish schedule
                </button>
              )}

              {session.status === "SCHEDULED" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void onRun(async () => {
                      await setSessionStatus(
                        session.id,
                        "ACTIVE"
                      );

                      onNotice(
                        "Session activated."
                      );

                      onRefresh();
                    })
                  }
                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Activate
                </button>
              )}

              {session.status === "ACTIVE" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void onRun(async () => {
                      await setSessionStatus(
                        session.id,
                        "COMPLETED"
                      );

                      onNotice(
                        "Session completed."
                      );

                      onRefresh();
                    })
                  }
                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Complete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={createSchedule}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="text-base font-bold text-slate-900">
              Schedule examination paper
            </h3>

            <div className="mt-4 space-y-4">
              <EntityPicker
                label="Course offering"
                value={courseOfferingId}
                onChange={setCourseOfferingId}
                entity="course-offering"
              />

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Scheduled at
                </span>

                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) =>
                    setScheduledAt(
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Duration
                  </span>

                  <input
                    type="number"
                    min="1"
                    value={durationMinutes}
                    onChange={(event) =>
                      setDurationMinutes(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Maximum marks
                  </span>

                  <input
                    type="number"
                    min="1"
                    value={maxMarks}
                    onChange={(event) =>
                      setMaxMarks(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Room
                </span>

                <select
                  value={roomId}
                  onChange={(event) =>
                    setRoomId(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">
                    Select later
                  </option>

                  {rooms.map((room) => (
                    <option
                      key={room.id}
                      value={room.id}
                    >
                      {room.name} ·{" "}
                      {room.building} ·{" "}
                      {room.capacity} seats
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Schedule paper
              </button>
            </div>
          </form>

          <form
            onSubmit={createRoom}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="text-base font-bold text-slate-900">
              Add examination room
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Room name
                </span>

                <input
                  value={roomName}
                  onChange={(event) =>
                    setRoomName(
                      event.target.value
                    )
                  }
                  required
                  placeholder="Room 101"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Building
                </span>

                <input
                  value={building}
                  onChange={(event) =>
                    setBuilding(
                      event.target.value
                    )
                  }
                  required
                  placeholder="Main Block"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Floor
                </span>

                <input
                  value={floor}
                  onChange={(event) =>
                    setFloor(
                      event.target.value
                    )
                  }
                  required
                  placeholder="1"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Capacity
                </span>

                <input
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(event) =>
                    setCapacity(
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Add room
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Scheduled papers
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Manage seating, hall tickets and marks for each paper.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
          >
            Refresh
          </button>
        </div>

        {session.schedules.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No papers have been scheduled for this session.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {session.schedules.map(
              (schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  rooms={rooms}
                  busy={busy}
                  canManage={canManage}
                  canApprove={canApprove}
                  onRun={onRun}
                  onRefresh={onRefresh}
                  onOpenMarks={onOpenMarks}
                  onNotice={onNotice}
                  onError={onError}
                />
              )
            )}
          </div>
        )}
      </section>
    </section>
  );
}

function ScheduleCard({
  schedule,
  rooms,
  busy,
  canManage,
  canApprove,
  onRun,
  onRefresh,
  onOpenMarks,
  onNotice,
  onError,
}: {
  schedule: ExamSchedule;
  rooms: ExamRoom[];
  busy: boolean;
  canManage: boolean;
  canApprove: boolean;
  onRun: (
    fn: () => Promise<void>
  ) => Promise<void>;
  onRefresh: () => void;
  onOpenMarks: (scheduleId: string) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [invigilatorId, setInvigilatorId] =
    useState("");
  const [roomId, setRoomId] =
    useState(schedule.roomId ?? "");

  return (
    <article className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-slate-900">
            {schedule.courseOffering?.course?.code ??
              "Course"}{" "}
            —{" "}
            {schedule.courseOffering?.course?.name ??
              "Examination"}
          </h4>

          <p className="mt-1 text-xs text-slate-500">
            {new Date(
              schedule.scheduledAt
            ).toLocaleString()}{" "}
            · {schedule.durationMinutes} minutes ·{" "}
            {schedule.maxMarks} marks
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Status:{" "}
            <span className="font-semibold">
              {schedule.status}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onOpenMarks(schedule.id)
            }
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Marks
          </button>

          {canManage && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRun(async () => {
                    await allocateSeating(
                      schedule.id
                    );

                    onNotice(
                      "Seating allocated."
                    );

                    onRefresh();
                  })
                }
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Allocate seating
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRun(async () => {
                    await generateHallTickets(
                      schedule.id
                    );

                    onNotice(
                      "Hall tickets generated."
                    );

                    onRefresh();
                  })
                }
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Hall tickets
              </button>
            </>
          )}

          {canApprove &&
            schedule.status ===
              "MARKS_SUBMITTED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRun(async () => {
                    await approveMarks(
                      schedule.id
                    );

                    onNotice(
                      "Marks approved."
                    );

                    onRefresh();
                  })
                }
                className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
            )}

          {canApprove &&
            schedule.status ===
              "MARKS_APPROVED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRun(async () => {
                    await lockSchedule(
                      schedule.id
                    );

                    onNotice(
                      "Schedule locked."
                    );

                    onRefresh();
                  })
                }
                className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
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
                  void onRun(async () => {
                    await publishResults(
                      schedule.id
                    );

                    onNotice(
                      "Results published."
                    );

                    onRefresh();
                  })
                }
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Publish results
              </button>
            )}
        </div>
      </div>

      {canManage && (
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Room
            </span>

            <select
              value={roomId}
              onChange={(event) =>
                setRoomId(
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
            >
              <option value="">
                Select room
              </option>

              {rooms.map((room) => (
                <option
                  key={room.id}
                  value={room.id}
                >
                  {room.name} ·{" "}
                  {room.capacity}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Invigilator
            </span>

            <EntityPicker
              label=""
              value={invigilatorId}
              onChange={setInvigilatorId}
              entity="user"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              disabled={
                busy ||
                !roomId ||
                !invigilatorId
              }
              onClick={() =>
                void onRun(async () => {
                  await createExamSchedule({
                    sessionId:
                      schedule.sessionId,
                    courseOfferingId:
                      schedule.courseOfferingId,
                    scheduledAt:
                      schedule.scheduledAt,
                    durationMinutes:
                      schedule.durationMinutes,
                    maxMarks:
                      schedule.maxMarks,
                    roomId,
                    invigilatorId,
                  });

                  onNotice(
                    "Schedule assignment saved."
                  );

                  onRefresh();
                })
              }
              className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Save room & invigilator
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function MarksWorkspace({
  sheet,
  draft,
  setDraft,
  busy,
  canManage,
  canApprove,
  onSave,
  onApprove,
}: {
  sheet: {
    schedule: ExamSchedule;
    rows: MarksRow[];
  } | null;
  draft: Record<string, string>;
  setDraft: React.Dispatch<
    React.SetStateAction<
      Record<string, string>
    >
  >;
  busy: boolean;
  canManage: boolean;
  canApprove: boolean;
  onSave: () => void;
  onApprove: () => void;
}) {
  if (!sheet) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Marks entry
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Open a scheduled paper from the Sessions & schedules tab to
          enter marks.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Marks sheet
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-950">
            {sheet.schedule.courseOffering?.course?.code ??
              "Course"}{" "}
            —{" "}
            {sheet.schedule.courseOffering?.course?.name ??
              "Examination"}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Maximum marks:{" "}
            {sheet.schedule.maxMarks}
          </p>
        </div>

        <div className="flex gap-2">
          {canManage && (
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Save marks
            </button>
          )}

          {canApprove && (
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Approve marks
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="pb-3">
                Student
              </th>

              <th className="pb-3">
                Roll number
              </th>

              <th className="pb-3">
                Marks
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sheet.rows.map((row) => (
              <tr key={row.studentId}>
                <td className="py-3 font-semibold text-slate-900">
                  {row.studentName}
                </td>

                <td className="py-3 text-slate-500">
                  {row.rollNumber ??
                    "—"}
                </td>

                <td className="py-3">
                  {canManage ? (
                    <input
                      value={
                        draft[
                          row.studentId
                        ] ?? ""
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
                      placeholder="Marks / AB"
                      className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  ) : (
                    <span className="font-semibold text-slate-700">
                      {row.isAbsent
                        ? "AB"
                        : row.marksObtained ??
                          "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
