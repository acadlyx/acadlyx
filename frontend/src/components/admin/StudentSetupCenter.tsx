"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: string;
  profile?: { admissionNumber?: string | null } | null;
  currentEnrollment?: {
    program?: { name?: string; code?: string } | null;
    academicYear?: { name?: string } | null;
    semester?: { name?: string } | null;
    section?: { name?: string } | null;
  } | null;
};

export function StudentSetupCenter() {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await apiFetch<{ data: Student[] }>("/students?page=1&pageSize=100");
      setStudents(response.data || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load students.");
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return students;
    return students.filter((student) =>
      [student.firstName, student.lastName, student.email, student.idNumber, student.profile?.admissionNumber]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(value))
    );
  }, [students, query]);

  async function setup() {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch<{ data: { summary: { compulsoryAssigned: number; electivesAvailable: number; registeredCredits: number }; complete: boolean } }>(
        "/students/" + selected.id + "/complete-setup",
        { method: "POST", body: "{}" }
      );
      const summary = response.data.summary;
      setMessage(
        (response.data.complete ? "Setup complete. " : "Setup completed with follow-up items. ") +
        summary.compulsoryAssigned + " compulsory courses assigned, " +
        summary.registeredCredits + " credits active, " +
        summary.electivesAvailable + " electives available."
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acadlyx-workspace-content">
      <div className="acadlyx-page-header">
        <div>
          <p className="acadlyx-eyebrow">Student operations</p>
          <h1 className="acadlyx-page-title">Student Setup Center</h1>
          <p className="acadlyx-page-description">
            Complete a student&apos;s academic setup from one place. ACADLYX verifies the active enrollment and assigns all compulsory offerings for the student&apos;s section.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <section className="acadlyx-card overflow-hidden">
          <div className="border-b border-[var(--acadlyx-border)] p-5">
            <h2 className="text-base font-black">Students</h2>
            <input className="acadlyx-input mt-4" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, ID or admission number" />
          </div>
          <div className="max-h-[650px] overflow-y-auto">
            {filtered.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => { setSelected(student); setMessage(""); setError(""); }}
                className={"flex w-full items-center justify-between gap-4 border-b border-[var(--acadlyx-border)] px-5 py-4 text-left hover:bg-[var(--acadlyx-surface-soft)] " + (selected?.id === student.id ? "bg-[var(--acadlyx-primary-soft)]" : "")}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{student.firstName} {student.lastName}</span>
                  <span className="block truncate text-xs text-[var(--acadlyx-muted)]">{student.profile?.admissionNumber || student.idNumber} · {student.email}</span>
                </span>
                <span className="shrink-0 text-xs font-bold">{student.currentEnrollment?.program?.code || "Unassigned"}</span>
              </button>
            ))}
            {!filtered.length ? <div className="acadlyx-empty-state"><h2>No students found</h2></div> : null}
          </div>
        </section>

        <section className="acadlyx-card h-fit p-5">
          <p className="acadlyx-eyebrow">One-click workflow</p>
          <h2 className="text-xl font-black">{selected ? selected.firstName + " " + selected.lastName : "Select a student"}</h2>
          {selected ? (
            <>
              <div className="mt-5 grid gap-3">
                <div className="acadlyx-card-soft p-3"><b>Program</b><div>{selected.currentEnrollment?.program?.name || "Not assigned"}</div></div>
                <div className="acadlyx-card-soft p-3"><b>Academic year</b><div>{selected.currentEnrollment?.academicYear?.name || "Not assigned"}</div></div>
                <div className="acadlyx-card-soft p-3"><b>Semester</b><div>{selected.currentEnrollment?.semester?.name || "Not assigned"}</div></div>
                <div className="acadlyx-card-soft p-3"><b>Section</b><div>{selected.currentEnrollment?.section?.name || "Not assigned"}</div></div>
              </div>
              <button type="button" className="acadlyx-button acadlyx-button-primary mt-5 w-full" onClick={() => void setup()} disabled={busy}>
                {busy ? "Completing setup…" : "Complete student setup"}
              </button>
              <p className="mt-3 text-xs leading-5 text-[var(--acadlyx-muted)]">
                Compulsory offerings are assigned automatically. Existing registrations are preserved. Electives remain available for deliberate selection.
              </p>
              {message ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}
              {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            </>
          ) : <div className="acadlyx-empty-state"><p>Select a student to begin.</p></div>}
        </section>
      </div>
    </div>
  );
}
