"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch, getCurrentUser, type AuthUser } from "@/lib/auth";

type ModuleKey =
  | "departments"
  | "programs"
  | "academic-years"
  | "semesters"
  | "sections"
  | "courses"
  | "course-offerings"
  | "campuses";

type Row = Record<string, unknown>;
type FieldType = "text" | "number" | "date" | "checkbox" | "uuid";

type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  create?: boolean;
  update?: boolean;
  placeholder?: string;
};

type ModuleConfig = {
  title: string;
  endpoint: string;
  columns: string[];
  fields: Field[];
};

const CONFIG: Record<ModuleKey, ModuleConfig> = {
  departments: {
    title: "Departments",
    endpoint: "/departments",
    columns: ["name", "code", "isActive"],
    fields: [
      { key: "name", label: "Department name", type: "text", required: true },
      { key: "code", label: "Department code", type: "text", required: true },
      { key: "campusId", label: "Campus ID", type: "uuid", placeholder: "Optional campus UUID" },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  programs: {
    title: "Programs",
    endpoint: "/programs",
    columns: ["name", "code", "level", "durationYears", "isActive"],
    fields: [
      { key: "departmentId", label: "Department ID", type: "uuid", required: true, placeholder: "Department UUID" },
      { key: "name", label: "Program name", type: "text", required: true },
      { key: "code", label: "Program code", type: "text", required: true },
      { key: "level", label: "Level", type: "text", required: true, placeholder: "e.g. B.Tech" },
      { key: "durationYears", label: "Duration (years)", type: "number", required: true },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  "academic-years": {
    title: "Academic Years",
    endpoint: "/academic-years",
    columns: ["name", "startDate", "endDate", "isCurrent"],
    fields: [
      { key: "name", label: "Academic year", type: "text", required: true, placeholder: "2026-2027" },
      { key: "startDate", label: "Start date", type: "date", required: true },
      { key: "endDate", label: "End date", type: "date", required: true },
      { key: "isCurrent", label: "Current year", type: "checkbox" },
    ],
  },
  semesters: {
    title: "Semesters",
    endpoint: "/semesters",
    columns: ["name", "number", "isActive"],
    fields: [
      { key: "programId", label: "Program ID", type: "uuid", required: true, placeholder: "Program UUID" },
      { key: "academicYearId", label: "Academic year ID", type: "uuid", required: true, placeholder: "Academic year UUID" },
      { key: "number", label: "Semester number", type: "number", required: true },
      { key: "name", label: "Semester name", type: "text", required: true, placeholder: "Semester 3" },
      { key: "startDate", label: "Start date", type: "date" },
      { key: "endDate", label: "End date", type: "date" },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  sections: {
    title: "Sections",
    endpoint: "/sections",
    columns: ["name", "capacity", "isActive"],
    fields: [
      { key: "semesterId", label: "Semester ID", type: "uuid", required: true, placeholder: "Semester UUID" },
      { key: "name", label: "Section name", type: "text", required: true, placeholder: "A" },
      { key: "capacity", label: "Capacity", type: "number" },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  courses: {
    title: "Courses",
    endpoint: "/courses",
    columns: ["name", "code", "credits", "isActive"],
    fields: [
      { key: "departmentId", label: "Department ID", type: "uuid", required: true, placeholder: "Department UUID" },
      { key: "code", label: "Course code", type: "text", required: true },
      { key: "name", label: "Course name", type: "text", required: true },
      { key: "credits", label: "Credits", type: "number", required: true },
      { key: "description", label: "Description", type: "text", placeholder: "Optional course description" },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  "course-offerings": {
    title: "Course Offerings",
    endpoint: "/course-offerings",
    columns: ["course", "semester", "section", "faculty", "registrationOpen", "isActive"],
    fields: [
      { key: "courseId", label: "Course ID", type: "uuid", required: true, placeholder: "Course UUID" },
      { key: "semesterId", label: "Semester ID", type: "uuid", required: true, placeholder: "Semester UUID" },
      { key: "sectionId", label: "Section ID", type: "uuid", required: true, placeholder: "Section UUID" },
      { key: "facultyId", label: "Faculty ID", type: "uuid", placeholder: "Optional faculty UUID" },
      { key: "capacity", label: "Capacity", type: "number" },
      { key: "registrationOpen", label: "Registration open", type: "checkbox" },
      { key: "isElective", label: "Elective", type: "checkbox" },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  campuses: {
    title: "Campuses",
    endpoint: "/campuses",
    columns: ["name", "code", "address", "isActive"],
    fields: [
      { key: "name", label: "Campus name", type: "text", required: true },
      { key: "code", label: "Campus code", type: "text", required: true },
      { key: "address", label: "Address", type: "text" },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
};

const permissionFor = (module: ModuleKey, action: "create" | "update" | "delete") =>
  `${module}.${action}`;

function normalizeRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: Row[] }).items;
  }
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: Row[] }).data;
  }
  return [];
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    return String(item.name ?? item.code ?? item.title ?? item.id ?? "—");
  }
  return String(value);
}

function valueForField(row: Row | null, field: Field): string | boolean {
  if (!row) return field.type === "checkbox" ? false : "";
  const raw = row[field.key];
  if (field.type === "checkbox") return Boolean(raw);
  if (field.type === "date" && raw) return String(raw).slice(0, 10);
  if (field.type === "uuid" && raw && typeof raw === "object") {
    return String((raw as Row).id ?? "");
  }
  return raw === null || raw === undefined ? "" : String(raw);
}

function buildPayload(form: HTMLFormElement, fields: Field[], editing: boolean) {
  const payload: Row = {};
  for (const field of fields) {
    if (editing && field.update === false) continue;
    const input = form.elements.namedItem(field.key) as HTMLInputElement | null;
    if (!input) continue;
    if (field.type === "checkbox") {
      payload[field.key] = input.checked;
      continue;
    }
    const value = input.value.trim();
    if (!value) continue;
    payload[field.key] = field.type === "number" ? Number(value) : value;
  }
  return payload;
}

export default function AdminAcademicDataPage({ module }: { module: ModuleKey }) {
  const router = useRouter();
  const config = CONFIG[module];
  const [rows, setRows] = useState<Row[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user]);
  const canCreate = permissions.has(permissionFor(module, "create"));
  const canUpdate = permissions.has(permissionFor(module, "update"));
  const canDelete = permissions.has(permissionFor(module, "delete"));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [currentUser, response] = await Promise.all([
        getCurrentUser({ background: true }),
        authedFetch<{ data: unknown }>(`${config.endpoint}?page=1&pageSize=500`),
      ]);
      setUser(currentUser);
      setRows(normalizeRows(response.data));
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, router]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditingRow(null);
    setNotice("");
    setError("");
    setEditorOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditingRow(row);
    setNotice("");
    setError("");
    setEditorOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = buildPayload(event.currentTarget, config.fields, Boolean(editingRow));
      const method = editingRow ? "PATCH" : "POST";
      const endpoint = editingRow
        ? `${config.endpoint}/${String(editingRow.id)}`
        : config.endpoint;
      await authedFetch(endpoint, { method, body: JSON.stringify(payload) });
      setEditorOpen(false);
      setNotice(editingRow ? "Record updated successfully." : "Record created successfully.");
      await load();
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to save this record.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`Deactivate ${display(row.name ?? row.code ?? row.id)}?`)) return;
    setError("");
    setNotice("");
    try {
      await authedFetch(`${config.endpoint}/${String(row.id)}`, { method: "DELETE" });
      setNotice("Record deactivated successfully.");
      await load();
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to deactivate this record.");
    }
  };

  return (
    <DashboardShell
      title={config.title}
      subtitle="Institution-scoped live data from the canonical backend"
      allowedRoles={["INSTITUTION_ADMIN"]}
    >
      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Academic structure management</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{config.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? "Loading…" : `${rows.length} records returned from the institution API.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <button type="button" onClick={openCreate} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                Add {config.title.replace(/s$/, "").replace("Academic Year", "Academic Year")}
              </button>
            ) : null}
            <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {loading ? "Refreshing…" : "Refresh data"}
            </button>
          </div>
        </section>

        {notice ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</section> : null}
        {error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p className="font-bold">Action could not be completed</p><p className="mt-1">{error}</p><button type="button" onClick={() => void load()} className="mt-3 font-bold underline">Retry</button></section> : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading live records…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              <p>No records are currently configured.</p>
              {canCreate ? <button type="button" onClick={openCreate} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Create first record</button> : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-black text-slate-600">Record</th>
                    {config.columns.map((field) => <th key={field} className="px-4 py-3 font-black capitalize text-slate-600">{field.replace(/([A-Z])/g, " $1")}</th>)}
                    {(canUpdate || canDelete) ? <th className="px-4 py-3 text-right font-black text-slate-600">Manage</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <tr key={String(row.id ?? index)} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{display(row.name ?? row.title ?? row.code ?? row.id)}</td>
                      {config.columns.map((field) => <td key={field} className="px-4 py-3 text-slate-600">{display(row[field])}</td>)}
                      {(canUpdate || canDelete) ? (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {canUpdate ? <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">Edit</button> : null}
                            {canDelete ? <button type="button" onClick={() => void remove(row)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">Deactivate</button> : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">{editingRow ? "Edit record" : "Create record"}</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{editingRow ? "Update " : "Add "}{config.title}</h2>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100" aria-label="Close">×</button>
            </div>

            <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
              {config.fields.filter((field) => !editingRow || field.update !== false).map((field) => (
                <label key={field.key} className={field.type === "checkbox" ? "flex items-center gap-3 rounded-xl border border-slate-200 p-3" : "space-y-1.5"}>
                  {field.type === "checkbox" ? (
                    <>
                      <input
                        name={field.key}
                        type="checkbox"
                        defaultChecked={Boolean(valueForField(editingRow, field))}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-bold text-slate-700">{field.label}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-black uppercase tracking-wide text-slate-600">{field.label}{field.required ? " *" : ""}</span>
                      <input
                        name={field.key}
                        type={field.type === "uuid" ? "text" : field.type}
                        required={field.required}
                        defaultValue={String(valueForField(editingRow, field))}
                        placeholder={field.placeholder}
                        min={field.type === "number" ? "1" : undefined}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
                      />
                    </>
                  )}
                </label>
              ))}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={() => setEditorOpen(false)} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {saving ? "Saving…" : editingRow ? "Save changes" : "Create record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
