"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { createExam, listOfferings, listUsers } from "@/lib/erpApi";

type Offering = {
  id: string;
  course?: { code?: string; name?: string } | null;
  section?: { name?: string } | null;
  semester?: { name?: string; number?: number } | null;
};

type User = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  idNumber?: string;
};

export default function ExaminationOperationsPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [selectedOffering, setSelectedOffering] = useState("");
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [offeringResult, studentResult] = await Promise.all([
          listOfferings(),
          listUsers("STUDENT"),
        ]);
        if (!active) return;
        setOfferings(offeringResult as Offering[]);
        setStudents(studentResult as User[]);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load examination data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const selected = useMemo(
    () => offerings.find((item) => item.id === selectedOffering),
    [offerings, selectedOffering],
  );

  async function publish() {
    if (!selectedOffering || !title.trim() || !examDate || Number(maxMarks) <= 0) {
      setError("Select a course, enter the examination title, date and valid maximum marks.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createExam({
        courseOfferingId: selectedOffering,
        title: title.trim(),
        examDate,
        maxMarks: Number(maxMarks),
      });
      setMessage("Examination created successfully. Continue to seating/admit-card publication from the examination workflow.");
      setTitle("");
      setExamDate("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create examination.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell
      title="Examination Operations"
      subtitle="Guided examination setup and publishing"
      allowedRoles={["EXAMINATION"]}
    >
      <main className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Examination workspace</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Exam Setup Center</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              A new examiner should not have to understand the entire ERP. Follow the workflow from course selection to publication, with only the controls required for examination operations.
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {[
              ["1", "Select offering", "Choose the course and section."],
              ["2", "Create exam", "Set title, date and maximum marks."],
              ["3", "Prepare seating", "Assign students and rooms."],
              ["4", "Publish", "Release the examination and admit cards."],
            ].map(([number, label, description]) => (
              <div key={number} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">{number}</div>
                <h2 className="mt-4 text-sm font-black text-slate-900">{label}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
        {message ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Step 1–2</p>
              <h2 className="mt-1 text-xl font-black">Create examination</h2>
              <p className="mt-1 text-sm text-slate-500">Only examination-specific fields are shown here.</p>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Course offering</span>
                <select value={selectedOffering} onChange={(event) => setSelectedOffering(event.target.value)} disabled={loading || busy} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100">
                  <option value="">{loading ? "Loading course offerings…" : "Select course and section"}</option>
                  {offerings.map((item) => (
                    <option key={item.id} value={item.id}>
                      {[item.course?.code, item.course?.name, item.section?.name ? `Section ${item.section.name}` : null].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Examination title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mid Semester Examination" disabled={busy} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100" />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Examination date</span>
                  <input type="datetime-local" value={examDate} onChange={(event) => setExamDate(event.target.value)} disabled={busy} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Maximum marks</span>
                  <input type="number" min="1" value={maxMarks} onChange={(event) => setMaxMarks(event.target.value)} disabled={busy} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100" />
                </label>
              </div>

              <button type="button" onClick={() => void publish()} disabled={busy || loading} className="min-h-12 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "Creating examination…" : "Create examination"}
              </button>
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Live context</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Selected offering</h2>
            {selected ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-xs font-bold text-slate-400">Course</p>
                  <p className="mt-1 font-black text-slate-900">{selected.course?.code || "—"}</p>
                  <p className="text-sm text-slate-600">{selected.course?.name || "Unnamed course"}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-xs font-bold text-slate-400">Section</p>
                  <p className="mt-1 font-black text-slate-900">{selected.section?.name || "—"}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-xs font-bold text-slate-400">Students available</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{students.length}</p>
                  <p className="text-xs text-slate-500">Institution students available to the examiner workflow.</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-white p-5 text-sm leading-6 text-slate-500">
                Select an offering to see its academic context before creating the examination.
              </div>
            )}
          </aside>
        </div>
      </main>
    </DashboardShell>
  );
}
