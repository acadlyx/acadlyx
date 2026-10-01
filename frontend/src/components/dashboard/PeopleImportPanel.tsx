"use client";

import { useRef, useState } from "react";
import { commitPeopleImport, downloadPeopleTemplate, previewPeopleImport, type PeopleImportType, type PeopleImportPreview } from "@/lib/peopleImportApi";

const CARDS: Array<{ type: PeopleImportType; title: string; description: string; hint: string }> = [
  { type: "students", title: "Import Students", description: "Create or update student accounts, master profiles and academic enrolments in one controlled import.", hint: "Requires programCode + academicYear; section must belong to that programme/year." },
  { type: "faculty", title: "Import Faculty", description: "Create or update faculty accounts with employee identity and department ownership.", hint: "Department is resolved by departmentCode; faculty always receives FACULTY role." },
  { type: "staff", title: "Import Staff", description: "Bulk-create operational staff such as HR, Accounts, Admissions, Examination, Library, Placement or IT.", hint: "role + departmentCode are required; employeeCode must be unique." },
];

export function PeopleImportPanel() {
  const [active, setActive] = useState<PeopleImportType | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PeopleImportPreview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<PeopleImportType | null>(null);

  async function selectFile(type: PeopleImportType, selected: File) {
    setActive(type); setFile(selected); setPreview(null); setMessage(""); setBusy(true);
    try {
      const result = await previewPeopleImport(type, selected);
      setPreview(result);
      setMessage(result.canCommit ? "Validation passed. No department or identifier conflicts were found." : `${result.errors.length} row(s) need correction before import.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to validate the file.");
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function commit() {
    if (!active || !file || !preview?.canCommit) return;
    setBusy(true);
    try {
      const result = await commitPeopleImport(active, file);
      setMessage(`${result.imported} ${active} row(s) imported successfully.`);
      setPreview(null); setFile(null); setActive(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">BULK PEOPLE IMPORT</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Import people without manual entry</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Upload separate files for students, faculty and staff. ACADLYX validates email, admission/employee identifiers, department, programme and section relationships before anything is written.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">All-or-nothing import</span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {CARDS.map((card) => (
          <div key={card.type} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-black text-slate-950">{card.title}</h3>
            <p className="mt-2 text-sm leading-5 text-slate-500">{card.description}</p>
            <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-500">{card.hint}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { pendingTypeRef.current = card.type; setActive(card.type); inputRef.current?.click(); }} disabled={busy} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{busy && active === card.type ? "Validating…" : "Upload & Validate"}</button>
              <button type="button" onClick={() => downloadPeopleTemplate(card.type)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Template</button>
            </div>
          </div>
        ))}
      </div>

      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; const type = pendingTypeRef.current; if (selected && type) void selectFile(type, selected); }} />

      {message && <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${preview?.canCommit ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{message}</div>}

      {preview && !preview.canCommit && (
        <div className="mt-4 max-h-56 overflow-auto rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-red-700">Fix these rows before importing</p>
          <ul className="mt-2 space-y-1 text-sm text-red-700">{preview.errors.slice(0, 25).map((error) => <li key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>)}</ul>
        </div>
      )}

      {preview?.canCommit && file && active && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div><p className="font-black text-emerald-900">{preview.validRows} rows ready</p><p className="text-xs text-emerald-700">No cross-department or identifier conflicts detected.</p></div>
          <button type="button" onClick={() => void commit()} disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{busy ? "Importing…" : "Confirm Import"}</button>
        </div>
      )}
    </section>
  );
}
