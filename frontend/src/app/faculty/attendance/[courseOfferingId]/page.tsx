"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AttendanceMarkingSheet } from "@/components/faculty/AttendanceMarkingSheet";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import {
  openAttendanceSession,
  submitAttendanceRecords,
} from "@/lib/facultyApi";
import { AttendanceSessionData, AttendanceStatus } from "@/types/faculty";

type ViewState = "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

function dateToInputValue(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayDateString(): string {
  return dateToInputValue(new Date());
}

export default function TakeAttendancePage() {
  const router = useRouter();
  const params = useParams<{ courseOfferingId: string }>();
  const courseOfferingId = params.courseOfferingId;

  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [session, setSession] = useState<AttendanceSessionData | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [sessionDate, setSessionDate] = useState(todayDateString);

  async function loadSession(date: string) {
    setState("loading");
    setErrorMessage("");
    setSaveMessage("");
    setSaveState("idle");

    try {
      const data = await openAttendanceSession(courseOfferingId, date);
      setSession(data);

      const initial: Record<string, AttendanceStatus> = {};
      for (const record of data.roster) {
        if (record.status) {
          initial[record.studentId] = record.status;
        }
      }

      setStatuses(initial);
      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }

      setErrorMessage(err instanceof Error ? err.message : "Failed to load attendance");
      setState("error");
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    void loadSession(sessionDate);
    // The course offering ID is the route identity; date changes are handled
    // explicitly by the date picker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseOfferingId, router]);

  const totalCount = session?.roster.length ?? 0;
  const markedCount = Object.keys(statuses).length;
  const unmarkedCount = Math.max(0, totalCount - markedCount);

  const counts = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;

    for (const status of Object.values(statuses)) {
      if (status === "PRESENT") present += 1;
      if (status === "LATE") late += 1;
      if (status === "ABSENT") absent += 1;
    }

    return { present, late, absent };
  }, [statuses]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStatuses((previous) => ({
      ...previous,
      [studentId]: status,
    }));
    setSaveState("idle");
    setSaveMessage("");
  }

  function presentAll() {
    setStatuses((previous) => {
      const next = { ...previous };
      for (const student of session?.roster ?? []) {
        next[student.studentId] = "PRESENT";
      }
      return next;
    });
    setSaveState("idle");
    setSaveMessage("");
  }

  function absentAll() {
    setStatuses((previous) => {
      const next = { ...previous };
      for (const student of session?.roster ?? []) {
        next[student.studentId] = "ABSENT";
      }
      return next;
    });
    setSaveState("idle");
    setSaveMessage("");
  }

  async function handleSave(submit: boolean) {
    if (!session || totalCount === 0) return;

    setSaveState("saving");
    setSaveMessage("");

    const filled = { ...statuses };

    if (submit) {
      for (const student of session.roster) {
        if (!filled[student.studentId]) {
          filled[student.studentId] = "ABSENT";
        }
      }
    }

    const records = Object.entries(filled).map(([studentId, status]) => ({
      studentId,
      status,
    }));

    try {
      const updated = await submitAttendanceRecords(
        session.id,
        records,
        submit
      );

      setSession(updated);

      const refreshed: Record<string, AttendanceStatus> = {};
      for (const record of updated.roster) {
        if (record.status) {
          refreshed[record.studentId] = record.status;
        }
      }
      setStatuses(refreshed);

      setSaveState("saved");
      setSaveMessage(
        submit
          ? "Attendance submitted successfully. Authorised corrections can still be made later."
          : `Draft saved — ${records.length}/${totalCount} students marked.`
      );
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "Failed to save attendance");
    }
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading attendance roster…</p>
      </main>
    );
  }

  if (state === "error" || !session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-red-600">
          Couldn&apos;t load attendance
        </p>
        <p className="max-w-lg text-sm text-slate-500">{errorMessage}</p>
        <Link
          href="/faculty"
          className="text-sm text-acadlyx-primary underline"
        >
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/faculty"
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            ← Back to dashboard
          </Link>

          {session.isSubmitted ? (
            <StatusBadge tone="success">Submitted</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Draft</StatusBadge>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            {session.courseOffering.course.code} —{" "}
            {session.courseOffering.course.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Section {session.courseOffering.section.name}
          </p>
        </div>

        <DashboardCard className="mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label
                htmlFor="attendance-date"
                className="block text-xs font-medium text-slate-500"
              >
                Class date
              </label>
              <input
                id="attendance-date"
                type="date"
                value={sessionDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setSessionDate(value);
                  void loadSession(value);
                }}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              />
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-lg font-semibold text-slate-900">{totalCount}</p>
                <p className="text-[11px] text-slate-400">Students</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-lg font-semibold text-emerald-600">{counts.present}</p>
                <p className="text-[11px] text-slate-400">Present</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-lg font-semibold text-amber-600">{counts.late}</p>
                <p className="text-[11px] text-slate-400">Late</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-lg font-semibold text-red-600">{counts.absent}</p>
                <p className="text-[11px] text-slate-400">Absent</p>
              </div>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <AttendanceMarkingSheet
            roster={session.roster}
            statuses={statuses}
            onSetStatus={setStatus}
            onPresentAll={presentAll}
            onAbsentAll={absentAll}
          />

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              {unmarkedCount > 0
                ? `${unmarkedCount} unmarked — submitting will record them as absent.`
                : "Every student is marked."}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSave(false)}
                disabled={saveState === "saving" || markedCount === 0}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={() => void handleSave(true)}
                disabled={saveState === "saving" || totalCount === 0}
                className="rounded-lg bg-acadlyx-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {session.isSubmitted ? "Save Correction" : "Submit Attendance"}
              </button>
            </div>
          </div>

          {saveMessage && (
            <p
              className={`mt-3 text-sm ${
                saveState === "error"
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              {saveMessage}
            </p>
          )}
        </DashboardCard>
      </div>
    </main>
  );
}
