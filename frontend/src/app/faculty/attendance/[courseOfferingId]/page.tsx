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

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    let isMounted = true;
    openAttendanceSession(courseOfferingId, todayDateString())
      .then((s) => {
        if (!isMounted) return;
        setSession(s);
        const initial: Record<string, AttendanceStatus> = {};
        for (const r of s.roster) {
          if (r.status) initial[r.studentId] = r.status;
        }
        setStatuses(initial);
        setState("ready");
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setErrorMessage(err.message);
        setState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [courseOfferingId, router]);

  const markedCount = Object.keys(statuses).length;
  const totalCount = session?.roster.length ?? 0;
  const unmarkedCount = totalCount - markedCount;

  function toggle(studentId: string) {
    setStatuses((prev) => {
      const current = prev[studentId];
      const next = { ...prev };
      next[studentId] = current === "PRESENT" ? "ABSENT" : "PRESENT";
      return next;
    });
  }

  function presentAll() {
    if (!session) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const r of session.roster) next[r.studentId] = "PRESENT";
    setStatuses(next);
  }

  const records = useMemo(
    () =>
      Object.entries(statuses).map(([studentId, status]) => ({
        studentId,
        status,
      })),
    [statuses]
  );

  async function handleSave(submit: boolean) {
    if (!session) return;
    setSaveState("saving");
    setSaveMessage("");

    // Validation: on final submit, anyone left unmarked is recorded
    // absent — attendance defaults to "absent unless marked present".
    let toSend = records;
    if (submit && unmarkedCount > 0) {
      const filledIn = { ...statuses };
      for (const r of session.roster) {
        if (!filledIn[r.studentId]) filledIn[r.studentId] = "ABSENT";
      }
      setStatuses(filledIn);
      toSend = Object.entries(filledIn).map(([studentId, status]) => ({
        studentId,
        status,
      }));
    }

    try {
      const updated = await submitAttendanceRecords(session.id, toSend, submit);
      setSession(updated);
      setSaveState("saved");
      setSaveMessage(
        submit
          ? "Attendance submitted."
          : `Draft saved (${toSend.length}/${totalCount} marked).`
      );
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "Failed to save");
    }
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading roster…</p>
      </main>
    );
  }

  if (state === "error" || !session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-red-600">Couldn&apos;t load attendance</p>
        <p className="text-sm text-slate-500">{errorMessage}</p>
        <Link href="/faculty" className="text-sm text-acadlyx-primary underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/faculty" className="text-xs font-medium text-slate-500 hover:text-slate-800">
            ← Back to dashboard
          </Link>
          {session.isSubmitted && <StatusBadge tone="success">Submitted</StatusBadge>}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            {session.courseOffering.course.code} — Section {session.courseOffering.section.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(session.sessionDate).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · {markedCount}/{totalCount} marked
          </p>
        </div>

        <DashboardCard>
          <AttendanceMarkingSheet
            roster={session.roster}
            statuses={statuses}
            onToggle={toggle}
            onPresentAll={presentAll}
          />

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              {unmarkedCount > 0
                ? `${unmarkedCount} unmarked — will be recorded absent on submit`
                : "Everyone is marked"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saveState === "saving"}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saveState === "saving"}
                className="rounded-lg bg-acadlyx-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Submit Attendance
              </button>
            </div>
          </div>

          {saveMessage && (
            <p
              className={`mt-3 text-sm ${
                saveState === "error" ? "text-red-600" : "text-emerald-600"
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
