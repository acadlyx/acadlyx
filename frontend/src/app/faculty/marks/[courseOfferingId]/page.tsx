"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import { enterMarks, getCourseOfferingRoster, listMarksForOffering } from "@/lib/academicsApi";
import { InternalMarkEntry } from "@/types/academics";

interface RosterMember {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
}

type ViewState = "loading" | "ready" | "error";

export default function FacultyMarksEntryPage() {
  const router = useRouter();
  const params = useParams<{ courseOfferingId: string }>();
  const [state, setState] = useState<ViewState>("loading");
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const [component, setComponent] = useState("Internal 1");
  const [maxMarks, setMaxMarks] = useState(50);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  async function loadExisting(comp: string) {
    const existing = await listMarksForOffering(params.courseOfferingId);
    const forComponent = existing.filter((e: InternalMarkEntry) => e.component === comp);
    const map: Record<string, number> = {};
    for (const e of forComponent) {
      if (e.student) map[e.student.id] = e.marksObtained;
    }
    setMarks(map);
    if (forComponent[0]) setMaxMarks(forComponent[0].maxMarks);
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    let isMounted = true;
    getCourseOfferingRoster(params.courseOfferingId)
      .then(async (r) => {
        if (!isMounted) return;
        setRoster(r);
        await loadExisting(component);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.courseOfferingId, router]);

  async function handleComponentChange(comp: string) {
    setComponent(comp);
    await loadExisting(comp);
  }

  function setMark(studentId: string, value: number) {
    setMarks((prev) => ({ ...prev, [studentId]: value }));
  }

  async function handleSave() {
    setSaveState("saving");
    setSaveMessage("");
    try {
      const records = Object.entries(marks).map(([studentId, marksObtained]) => ({
        studentId,
        marksObtained,
      }));
      await enterMarks({
        courseOfferingId: params.courseOfferingId,
        component,
        maxMarks,
        records,
      });
      setSaveState("saved");
      setSaveMessage("Marks saved.");
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

  if (state === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-red-600">Couldn&apos;t load roster</p>
        <p className="text-sm text-slate-500">{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Link href="/faculty" className="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 mb-6 text-2xl font-semibold text-slate-900">Enter Internal Marks</h1>

        <DashboardCard className="mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Component</label>
              <input
                value={component}
                onChange={(e) => handleComponentChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Max Marks</label>
              <input
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <ul className="divide-y divide-slate-100">
            {roster.map((s) => (
              <li key={s.studentId} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm text-slate-800">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="text-xs text-slate-400">{s.rollNumber ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={maxMarks}
                    value={marks[s.studentId] ?? ""}
                    onChange={(e) => setMark(s.studentId, Number(e.target.value))}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-slate-400">/ {maxMarks}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              {Object.keys(marks).length}/{roster.length} entered
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="rounded-lg bg-acadlyx-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save Marks"}
            </button>
          </div>
          {saveMessage && (
            <p className={`mt-2 text-sm ${saveState === "error" ? "text-red-600" : "text-emerald-600"}`}>
              {saveMessage}
            </p>
          )}
        </DashboardCard>
      </div>
    </main>
  );
}
