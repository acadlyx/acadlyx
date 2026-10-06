"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EntityCombobox } from "@/components/ui/EntityCombobox";
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

type Row = Record<string, unknown> & { id?: string };
type FieldType = "text" | "number" | "date" | "checkbox" | "entity";

type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  create?: boolean;
  update?: boolean;
  placeholder?: string;
  source?: LookupSource;
  dependsOn?: string[];
  autoGenerate?: boolean;
};

type LookupSource = "campuses" | "departments" | "programs" | "years" | "semesters" | "sections" | "courses" | "faculty";

type ModuleConfig = {
  title: string;
  endpoint: string;
  columns: string[];
  fields: Field[];
};

const LOOKUPS: Record<LookupSource, string> = {
  campuses: "/campuses?page=1&pageSize=500",
  departments: "/departments?page=1&pageSize=500",
  programs: "/programs?page=1&pageSize=500",
  years: "/academic-years?page=1&pageSize=500",
  semesters: "/semesters?page=1&pageSize=500",
  sections: "/sections?page=1&pageSize=500",
  courses: "/courses?page=1&pageSize=500",
  faculty: "/users?page=1&pageSize=500&role=FACULTY",
};

const CONFIG: Record<ModuleKey, ModuleConfig> = {
  departments: {
    title: "Departments",
    endpoint: "/departments",
    columns: ["name", "code", "campus", "isActive"],
    fields: [
      { key: "name", label: "Department name", type: "text", required: true },
      { key: "code", label: "Department code", type: "text", required: true },
      { key: "campusId", label: "Campus", type: "entity", source: "campuses", placeholder: "Select campus" },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  programs: {
    title: "Programs",
    endpoint: "/programs",
    columns: ["name", "code", "level", "durationYears", "department", "isActive"],
    fields: [
      { key: "departmentId", label: "Department", type: "entity", source: "departments", required: true, placeholder: "Select department" },
      { key: "name", label: "Program name", type: "text", required: true },
      { key: "code", label: "Program code", type: "text", required: true },
      { key: "level", label: "Level", type: "text", required: true, placeholder: "e.g. Postgraduate" },
      { key: "durationYears", label: "Duration (years)", type: "number", required: true },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  "academic-years": {
    title: "Academic Years",
    endpoint: "/academic-years",
    columns: ["name", "startDate", "endDate", "isCurrent"],
    fields: [
      { key: "name", label: "Academic year", type: "text", required: true, placeholder: "2026–27" },
      { key: "startDate", label: "Start date", type: "date", required: true },
      { key: "endDate", label: "End date", type: "date", required: true },
      { key: "isCurrent", label: "Current year", type: "checkbox" },
    ],
  },
  semesters: {
    title: "Semesters",
    endpoint: "/semesters",
    columns: ["name", "number", "program", "academicYear", "startDate", "endDate", "isActive"],
    fields: [
      { key: "programId", label: "Program", type: "entity", source: "programs", required: true, placeholder: "Select program" },
      { key: "academicYearId", label: "Academic year", type: "entity", source: "years", required: true, placeholder: "Select academic year" },
      { key: "number", label: "Semester number", type: "number", required: true },
      { key: "name", label: "Semester name", type: "text", required: true, placeholder: "Semester 3", autoGenerate: true },
      { key: "startDate", label: "Start date", type: "date" },
      { key: "endDate", label: "End date", type: "date" },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  sections: {
    title: "Sections",
    endpoint: "/sections",
    columns: ["name", "semester", "capacity", "isActive"],
    fields: [
      { key: "semesterId", label: "Semester", type: "entity", source: "semesters", required: true, placeholder: "Select semester" },
      { key: "name", label: "Section name", type: "text", required: true, placeholder: "A" },
      { key: "capacity", label: "Capacity", type: "number" },
      { key: "isActive", label: "Active", type: "checkbox", update: true },
    ],
  },
  courses: {
    title: "Courses",
    endpoint: "/courses",
    columns: ["name", "code", "credits", "department", "isActive"],
    fields: [
      { key: "departmentId", label: "Department", type: "entity", source: "departments", required: true, placeholder: "Select department" },
      { key: "code", label: "Course code", type: "text", required: true, placeholder: "MCA-301" },
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
      { key: "courseId", label: "Course", type: "entity", source: "courses", required: true, placeholder: "Select course" },
      { key: "semesterId", label: "Semester", type: "entity", source: "semesters", required: true, placeholder: "Select semester" },
      { key: "sectionId", label: "Section", type: "entity", source: "sections", required: true, placeholder: "Select section" },
      { key: "facultyId", label: "Faculty", type: "entity", source: "faculty", placeholder: "Select faculty" },
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

const permissionFor = (module: ModuleKey, action: "create" | "update" | "delete") => `${module}.${action}`;

function normalizeRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) return (value as { items: Row[] }).items;
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) return (value as { data: Row[] }).data;
  return [];
}

function relationId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return String((value as Row).id ?? "");
  return "";
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    const item = value as Row;
    const name = String(item.name ?? item.title ?? "").trim();
    const code = String(item.code ?? "").trim();
    if (code && name) return `${code} — ${name}`;
    return name || String(item.email ?? "—");
  }
  return String(value);
}

function labelFor(source: LookupSource, item: Row): string {
  if (source === "faculty") {
    const name = `${String(item.firstName ?? "")} ${String(item.lastName ?? "")}`.trim();
    return name ? `${name}${item.email ? ` — ${String(item.email)}` : ""}` : String(item.email ?? "Faculty");
  }
  if (source === "semesters") {
    const number = item.number ?? "";
    const name = String(item.name ?? `Semester ${number}`).trim();
    return number ? `Semester ${number} — ${name}` : name;
  }
  if (source === "sections") return String(item.name ?? item.code ?? "Section");
  const name = String(item.name ?? item.title ?? "").trim();
  const code = String(item.code ?? "").trim();
  return code && name ? `${code} — ${name}` : name || String(item.email ?? "Unnamed");
}

function matchesDependency(item: Row, dependency: string, selected: string): boolean {
  if (!selected) return true;
  const raw = item[dependency];
  return relationId(raw) === selected;
}

function friendlyError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : "Unable to complete this action.";
  if (/uuid|invalid .*id|id is required|id must be/i.test(message)) return "Please select a valid related record.";
  return message;
}

function initialForm(module: ModuleKey, lookupData: Record<LookupSource, Row[]>): Row {
  const form: Row = {};
  if (module === "campuses") form.isActive = true;
  if (module === "departments") form.isActive = true;
  if (module === "programs") form.isActive = true;
  if (module === "academic-years") form.isCurrent = false;
  if (module === "semesters") form.isActive = true;
  if (module === "sections") form.isActive = true;
  if (module === "courses") form.isActive = true;
  if (module === "course-offerings") form.isActive = true;

  if (module === "departments" && lookupData.campuses.length === 1) {
    form.campusId = String(lookupData.campuses[0].id ?? "");
  }
  return form;
}

function valueForField(row: Row | null, field: Field): string | boolean {
  if (!row) return field.type === "checkbox" ? false : "";
  const raw = row[field.key];
  if (field.type === "checkbox") return Boolean(raw);
  if (field.type === "date" && raw) return String(raw).slice(0, 10);
  if (field.type === "entity") return relationId(raw);
  return raw === null || raw === undefined ? "" : String(raw);
}

export default function AdminAcademicDataPage({ module }: { module: ModuleKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const departmentId = searchParams.get("departmentId") || "";
  const config = CONFIG[module];
  const [rows, setRows] = useState<Row[]>([]);
  const [lookupData, setLookupData] = useState<Record<LookupSource, Row[]>>({
    campuses: [], departments: [], programs: [], years: [], semesters: [], sections: [], courses: [], faculty: [],
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user]);
  const canCreate = permissions.has(permissionFor(module, "create"));
  const canUpdate = permissions.has(permissionFor(module, "update"));
  const canDelete = permissions.has(permissionFor(module, "delete"));

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    const sources = Array.from(new Set(config.fields.map((field) => field.source).filter(Boolean))) as LookupSource[];
    const entries = await Promise.all(sources.map(async (source) => {
      try {
        const response = await authedFetch<{ data: unknown }>(`${source === "departments" && departmentId ? `/departments/${encodeURIComponent(departmentId)}` : LOOKUPS[source]}${source !== "departments" && LOOKUPS[source].includes("?") ? "&" : source !== "departments" ? "?" : ""}${source !== "departments" && departmentId && ["programs","semesters","sections","courses","course-offerings"].includes(source) ? `departmentId=${encodeURIComponent(departmentId)}` : ""}`);
        return [source, source === "departments" && departmentId ? (response.data ? [response.data as Row] : []) : normalizeRows(response.data)] as const;
      } catch {
        return [source, []] as const;
      }
    }));
    setLookupData((current) => ({ ...current, ...Object.fromEntries(entries) }));
    setLookupsLoading(false);
  }, [config.fields, departmentId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [currentUser, response] = await Promise.all([
        getCurrentUser({ background: true }),
        authedFetch<{ data: unknown }>(`${config.endpoint}?page=1&pageSize=100${departmentId ? `&departmentId=${encodeURIComponent(departmentId)}` : ""}`),
      ]);
      setUser(currentUser);
      setRows(normalizeRows(response.data));
      void loadLookups();
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(friendlyError(reason));
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, departmentId, loadLookups, router]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditingRow(null);
    const next = initialForm(module, lookupData);\n    if (departmentId && (module === "programs" || module === "courses")) next.departmentId = departmentId;\n    setForm(next);
    setNotice("");
    setError("");
    setEditorOpen(true);
  };

  const openEdit = (row: Row) => {
    const next: Row = {};
    for (const field of config.fields) {
      if (field.update === false) continue;
      next[field.key] = valueForField(row, field);
    }
    setEditingRow(row);
    setForm(next);
    setNotice("");
    setError("");
    setEditorOpen(true);
  };

  const setField = (field: Field, value: string | boolean) => {
    setForm((current) => {
      const next = { ...current, [field.key]: value };
      if (field.key === "number" && module === "semesters" && value) {
        const number = Number(value);
        if (Number.isInteger(number) && (!current.name || current.name === `Semester ${current.number}`)) next.name = `Semester ${number}`;
      }
      if (field.type === "entity" && !value) {
        if (field.key === "departmentId") {
          delete next.programId;
          delete next.courseId;
        }
        if (field.key === "programId") delete next.semesterId;
        if (field.key === "academicYearId") delete next.semesterId;
        if (field.key === "semesterId") delete next.sectionId;
      }
      return next;
    });
  };

  const optionsFor = (field: Field): Row[] => {
    if (!field.source) return [];
    let options = lookupData[field.source];
    if (field.source === "programs" && form.departmentId) options = options.filter((item) => matchesDependency(item, "departmentId", String(form.departmentId)));
    if (field.source === "semesters") {
      if (form.programId) options = options.filter((item) => matchesDependency(item, "programId", String(form.programId)));
      if (form.academicYearId) options = options.filter((item) => matchesDependency(item, "academicYearId", String(form.academicYearId)));
    }
    if (field.source === "sections" && form.semesterId) options = options.filter((item) => matchesDependency(item, "semesterId", String(form.semesterId)));
    return options;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      for (const field of config.fields) {
        if (editingRow && field.update === false) continue;
        if (field.required && (form[field.key] === undefined || form[field.key] === null || form[field.key] === "")) {
          setError(`Please select or enter ${field.label.toLowerCase()}.`);
          setSaving(false);
          return;
        }
      }

      const payload: Row = {};
      for (const field of config.fields) {
        if (editingRow && field.update === false) continue;
        const value = form[field.key];
        if (value === undefined || value === "") continue;
        payload[field.key] = field.type === "number" ? Number(value) : value;
      }

      const method = editingRow ? "PATCH" : "POST";
      const endpoint = editingRow ? `${config.endpoint}/${String(editingRow.id)}` : config.endpoint;
      await authedFetch(endpoint, { method, body: JSON.stringify(payload) });
      setEditorOpen(false);
      setNotice(editingRow ? "Record updated successfully." : "Record created successfully.");
      await load();
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(friendlyError(reason));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`Deactivate ${display(row.name ?? row.code ?? "this record")}?`)) return;
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
      setError(friendlyError(reason));
    }
  };

  return (
    <DashboardShell title={config.title} subtitle="Institution-scoped academic structure" allowedRoles={["INSTITUTION_ADMIN"]}>
      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">{departmentId ? "Department-scoped academic structure" : "Academic structure management"}</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{config.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{loading ? "Loading…" : `${rows.length} records returned from the institution.`}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate ? <button type="button" onClick={openCreate} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Add {config.title.replace(/s$/, "")}</button> : null}
            <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? "Refreshing…" : "Refresh data"}</button>
          </div>
        </section>

        {notice ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</section> : null}
        {error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p className="font-bold">Action could not be completed</p><p className="mt-1">{error}</p><button type="button" onClick={() => void load()} className="mt-3 font-bold underline">Retry</button></section> : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? <div className="p-10 text-center text-sm text-slate-500">Loading live records…</div> : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500"><p>No records are currently configured.</p>{canCreate ? <button type="button" onClick={openCreate} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Create first record</button> : null}</div>
          ) : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr>
              <th className="px-4 py-3 font-black text-slate-600">Record</th>
              {config.columns.map((field) => <th key={field} className="px-4 py-3 font-black capitalize text-slate-600">{field.replace(/([A-Z])/g, " $1")}</th>)}
              {(canUpdate || canDelete) ? <th className="px-4 py-3 text-right font-black text-slate-600">Manage</th> : null}
            </tr></thead><tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => <tr key={String(row.id ?? index)} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-900">{display(row.name ?? row.title ?? row.code ?? "Record")}</td>
                {config.columns.map((field) => <td key={field} className="px-4 py-3 text-slate-600">{display(row[field])}</td>)}
                {(canUpdate || canDelete) ? <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2">
                  {canUpdate ? <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">Edit</button> : null}
                  {canDelete ? <button type="button" onClick={() => void remove(row)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">Deactivate</button> : null}
                </div></td> : null}
              </tr>)}
            </tbody></table></div>
          )}
        </section>
      </main>

      {editorOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
        <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">{editingRow ? "Edit record" : "Create record"}</p><h2 className="mt-1 text-xl font-black text-slate-950">{editingRow ? "Update " : "Add "}{config.title}</h2></div><button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100" aria-label="Close">×</button></div>

          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            {config.fields.filter((field) => !editingRow || field.update !== false).map((field) => {
              const dependencyMissing = field.dependsOn?.some((dependency) => !form[dependency]);
              return <label key={field.key} className={field.type === "checkbox" ? "flex items-center gap-3 rounded-xl border border-slate-200 p-3" : "space-y-1.5"}>
                {field.type === "checkbox" ? <><input name={field.key} type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => setField(field, event.target.checked)} className="h-4 w-4" /><span className="text-sm font-bold text-slate-700">{field.label}</span></> : <>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-600">{field.label}{field.required ? " *" : ""}</span>
                  {field.type === "entity" && field.source ? <EntityCombobox
                    value={String(form[field.key] ?? "")}
                    options={optionsFor(field)}
                    onChange={(value) => setField(field, value)}
                    placeholder={dependencyMissing ? `Select ${field.label.toLowerCase()} after its parent` : (field.placeholder ?? `Select ${field.label.toLowerCase()}`)}
                    searchPlaceholder={`Search ${field.label.toLowerCase()}…`}
                    disabled={Boolean(dependencyMissing) || Boolean(departmentId && (module === "programs" || module === "courses") && field.key === "departmentId")}
                    loading={lookupsLoading}
                    getLabel={(item) => labelFor(field.source as LookupSource, item)}
                  /> : <input
                    name={field.key}
                    type={field.type}
                    required={field.required}
                    value={String(form[field.key] ?? "")}
                    onChange={(event) => setField(field, event.target.value)}
                    placeholder={field.placeholder}
                    min={field.type === "number" ? "1" : undefined}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
                  />}
                </>}
              </label>;
            })}
            <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setEditorOpen(false)} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : editingRow ? "Save changes" : "Create record"}</button></div>
          </form>
        </div>
      </div> : null}
    </DashboardShell>
  );
}
