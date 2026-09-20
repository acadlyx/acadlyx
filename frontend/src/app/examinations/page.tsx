"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "HOD",
  "STAFF",
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
    ["SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT", "HOD"].includes(
      role
    )
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
        setError(err instanceof Error ? err.message : "Something went wrong");
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
        return { studentId: row.studentId, isAbsent: true, marksObtained: null };
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
                            <span className="ml-2 text-xs text-slate-400">
                              {session.code}
                            </span>
                          </td>
                          <td className="py-2 text-slate-600">
                            {session.examType}
                          </td>
                          <td className="py-2 text-slate-600">
                            {new Date(session.startDate).toLocaleDateString()} –{" "}
                            {new Date(session.endDate).toLocaleDateString()}
                          </td>
                          <td className="py-2">
                            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                              {session.status}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void openSession(session.id)}
                              className="text-sm font-semibold text-slate-900"
                            >
                              Open →
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
              <SessionDetail
                session={active}
                rooms={rooms}
                canManage={canManage}
                canApprove={canApprove}
                busy={busy}
                onSchedule={(body) =>
                  run(async () => {
                    await createExamSchedule({
                      ...body,
                      examSessionId: active.id,
                    });
                    setActive(await getExamSession(active.id));
                    setNotice("Paper scheduled");
                  })
                }
                onSeating={(scheduleId, roomIds) =>
                  run(async () => {
                    const result = await allocateSeating(scheduleId, roomIds);
                    setNotice(
                      `Seated ${result.seated} students across ${result.rooms} room(s)`
                    );
                    setActive(await getExamSession(active.id));
                  })
                }
                onHallTickets={() =>
                  run(async () => {
                    const result = await generateHallTickets(active.id);
                    setNotice(
                      `Issued ${result.issued} hall tickets; ${result.blocked} blocked for dues or shortage`
                    );
                  })
                }
                onStatus={(status) =>
                  run(async () => {
                    await setSessionStatus(active.id, status);
                    setActive(await getExamSession(active.id));
                    await reload();
                  })
                }
                onOpenMarks={(scheduleId) => void openMarks(scheduleId)}
                onLock={(scheduleId) =>
                  run(async () => {
                    await lockSchedule(scheduleId);
                    setActive(await getExamSession(active.id));
                    setNotice("Paper locked");
                  })
                }
                onPublish={(scheduleId) =>
                  run(async () => {
                    const result = await publishResults(scheduleId);
                    setActive(await getExamSession(active.id));
                    setNotice(`Published ${result.published} results`);
                  })
                }
              />
            )}

            {canManage && (
              <NewRoomForm
                rooms={rooms}
                busy={busy}
                onCreate={(body) =>
                  run(async () => {
                    await createExamRoom(body);
                    setRooms(await listExamRooms());
                    setNotice("Room added");
                  })
                }
              />
            )}
          </>
        )}

        {tab === "marks" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {!sheet ? (
              <p className="text-sm text-slate-500">
                Open a scheduled paper from a session to enter marks.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {sheet.schedule.courseCode} — {sheet.schedule.courseName}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Max {sheet.schedule.maxMarks} · pass{" "}
                      {sheet.schedule.passMarks} · status{" "}
                      {sheet.schedule.status}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Enter a number, or <strong>AB</strong> for absent.
                  </p>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="pb-2">Roll</th>
                        <th className="pb-2">Student</th>
                        <th className="pb-2">Exam attendance</th>
                        <th className="pb-2">Marks</th>
                        <th className="pb-2">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sheet.rows.map((row) => (
                        <tr key={row.studentId}>
                          <td className="py-2 text-slate-500">
                            {row.rollNumber ?? "—"}
                          </td>
                          <td className="py-2 font-medium text-slate-900">
                            {row.firstName} {row.lastName}
                          </td>
                          <td className="py-2 text-slate-600">
                            {row.examAttendance ?? "—"}
                          </td>
                          <td className="py-2">
                            <input
                              value={draft[row.studentId] ?? ""}
                              disabled={
                                row.status === "APPROVED" ||
                                row.status === "PUBLISHED"
                              }
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  [row.studentId]: event.target.value,
                                }))
                              }
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1 disabled:bg-slate-100"
                            />
                          </td>
                          <td className="py-2 text-xs text-slate-500">
                            {row.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await saveMarks(sheet.schedule.id, marksPayload(), false);
                        setNotice("Draft saved");
                      })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await saveMarks(sheet.schedule.id, marksPayload(), true);
                        setSheet(await getMarksSheet(sheet.schedule.id));
                        setNotice("Submitted for approval");
                      })
                    }
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
                  >
                    Submit for approval
                  </button>
                  {canApprove && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const result = await approveMarks(sheet.schedule.id);
                          setSheet(await getMarksSheet(sheet.schedule.id));
                          setNotice(`Approved ${result.approved} entries`);
                        })
                      }
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
                    >
                      Approve
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
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
  onCreate: (body: Record<string, unknown>) => void;
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
    onCreate(form);
    setForm({ ...form, name: "", code: "" });
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-5"
    >
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-slate-600">Name</span>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="End Semester — Nov 2026"
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Code</span>
        <input
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="ESE-NOV26"
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Type</span>
        <select
          value={form.examType}
          onChange={(e) => setForm({ ...form, examType: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        >
          {["REGULAR", "SUPPLEMENTARY", "IMPROVEMENT"].map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Start</span>
        <input
          required
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">End</span>
        <input
          required
          type="date"
          value={form.endDate}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 sm:col-span-5 sm:w-48"
      >
        Create session
      </button>
    </form>
  );
}

function SessionDetail({
  session,
  rooms,
  canManage,
  canApprove,
  busy,
  onSchedule,
  onSeating,
  onHallTickets,
  onStatus,
  onOpenMarks,
  onLock,
  onPublish,
}: {
  session: ExamSession & { schedules: ExamSchedule[] };
  rooms: ExamRoom[];
  canManage: boolean;
  canApprove: boolean;
  busy: boolean;
  onSchedule: (body: Record<string, unknown>) => void;
  onSeating: (scheduleId: string, roomIds: string[]) => void;
  onHallTickets: () => void;
  onStatus: (status: string) => void;
  onOpenMarks: (scheduleId: string) => void;
  onLock: (scheduleId: string) => void;
  onPublish: (scheduleId: string) => void;
}) {
  const [offering, setOffering] = useState<DirectoryOption | null>(null);
  const [form, setForm] = useState({
    examDate: "",
    startTime: "10:00",
    endTime: "13:00",
    maxMarks: "100",
    passMarks: "40",
  });
  const [roomChoice, setRoomChoice] = useState<Record<string, string>>({});

  return (
    <section className="space-y-5 rounded-3xl border border-indigo-200 bg-indigo-50/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{session.name}</h2>
          <p className="text-sm text-slate-600">
            {session.status} · {session.schedules.length} paper(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <button
              type="button"
              disabled={busy}
              onClick={onHallTickets}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Generate hall tickets
            </button>
          )}
          {canApprove &&
            ["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED"].includes(
              session.status
            ) && (
              <select
                value=""
                disabled={busy}
                onChange={(event) =>
                  event.target.value && onStatus(event.target.value)
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <option value="">Move status…</option>
                {["SCHEDULED", "ONGOING", "COMPLETED", "PUBLISHED", "CANCELLED"].map(
                  (status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  )
                )}
              </select>
            )}
        </div>
      </div>

      {canManage && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!offering) return;
            onSchedule({
              courseOfferingId: offering.id,
              examDate: form.examDate,
              startTime: form.startTime,
              endTime: form.endTime,
              maxMarks: Number(form.maxMarks),
              passMarks: Number(form.passMarks),
            });
            setOffering(null);
          }}
          className="grid gap-3 rounded-2xl bg-white p-5 sm:grid-cols-6"
        >
          <div className="sm:col-span-2">
            <EntityPicker
              kind="courseOffering"
              label="Course offering"
              value={offering}
              onChange={setOffering}
              required
            />
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">Date</span>
            <input
              required
              type="date"
              value={form.examDate}
              onChange={(e) => setForm({ ...form, examDate: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">Start</span>
            <input
              required
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">End</span>
            <input
              required
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Max</span>
              <input
                required
                value={form.maxMarks}
                onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Pass</span>
              <input
                required
                value={form.passMarks}
                onChange={(e) => setForm({ ...form, passMarks: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !offering}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 sm:col-span-6 sm:w-48"
          >
            Schedule paper
          </button>
        </form>
      )}

      <div className="space-y-3">
        {session.schedules.map((schedule) => (
          <div
            key={schedule.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4"
          >
            <div>
              <p className="font-semibold text-slate-900">
                {schedule.courseCode} — {schedule.courseName}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(schedule.examDate).toLocaleDateString()} ·{" "}
                {schedule.startTime}–{schedule.endTime} · {schedule.status} ·{" "}
                {schedule.seatCount} seat(s) · {schedule.markCount} mark(s)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && rooms.length > 0 && (
                <>
                  <select
                    value={roomChoice[schedule.id] ?? ""}
                    onChange={(event) =>
                      setRoomChoice((current) => ({
                        ...current,
                        [schedule.id]: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="">Room…</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name} ({room.capacity})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !roomChoice[schedule.id]}
                    onClick={() =>
                      onSeating(schedule.id, [roomChoice[schedule.id]])
                    }
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Allocate seating
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onOpenMarks(schedule.id)}
                className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
              >
                Marks
              </button>
              {canApprove && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onLock(schedule.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Lock
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPublish(schedule.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Publish
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NewRoomForm({
  rooms,
  busy,
  onCreate,
}: {
  rooms: ExamRoom[];
  busy: boolean;
  onCreate: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ name: "", code: "", capacity: "60" });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Examination rooms</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCreate({ ...form, capacity: Number(form.capacity) });
          setForm({ name: "", code: "", capacity: "60" });
        }}
        className="mt-3 flex flex-wrap items-end gap-3"
      >
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-48 rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">Code</span>
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="w-32 rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">Capacity</span>
          <input
            required
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            className="w-28 rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          Add room
        </button>
      </form>

      {rooms.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {room.name} · {room.capacity}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
