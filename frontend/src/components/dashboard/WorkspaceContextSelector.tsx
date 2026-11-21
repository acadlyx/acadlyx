"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceContext, type WorkspaceContext } from "@/lib/workspaceContext";

type SelectionKey =
  | "campusId"
  | "departmentId"
  | "programId"
  | "academicYearId"
  | "batchId"
  | "semesterId"
  | "sectionId";

type WorkspaceSelection = Partial<Record<SelectionKey, string>>;
type InstitutionBrand = { name: string; logoUrl: string | null };

const SELECTION_KEYS: SelectionKey[] = [
  "campusId",
  "departmentId",
  "programId",
  "academicYearId",
  "batchId",
  "semesterId",
  "sectionId",
];

const RESET_DEPENDENTS: Partial<Record<SelectionKey, SelectionKey[]>> = {
  campusId: ["departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"],
  departmentId: ["programId", "academicYearId", "batchId", "semesterId", "sectionId"],
  programId: ["academicYearId", "batchId", "semesterId", "sectionId"],
  academicYearId: ["semesterId", "sectionId"],
  semesterId: ["sectionId"],
};

const SELECT_CLASS =
  "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50";

function selectionFromQuery(query: URLSearchParams | { get(name: string): string | null }): WorkspaceSelection {
  const selection: WorkspaceSelection = {};
  for (const key of SELECTION_KEYS) {
    const value = query.get(key);
    if (value) selection[key] = value;
  }
  return selection;
}

function withQuerySelection(
  pathname: string,
  currentQuery: string,
  selection: WorkspaceSelection,
): string {
  const query = new URLSearchParams(currentQuery);
  for (const key of SELECTION_KEYS) {
    const value = selection[key];
    if (value) query.set(key, value);
    else query.delete(key);
  }
  const suffix = query.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

function Field({
  label,
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<{ id: string; label: string }>;
  disabled?: boolean;
  onChange(value: string): void;
}) {
  return (
    <label className="block min-w-0 text-xs font-bold text-slate-600">
      <span>{label}</span>
      <select className={SELECT_CLASS} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function WorkspaceContextSelector({
  onInstitutionBrand,
}: {
  onInstitutionBrand?: (brand: InstitutionBrand) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSelection = useMemo(
    () => selectionFromQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [draft, setDraft] = useState<WorkspaceSelection>(urlSelection);
  const contextParams = useMemo(
    () => Object.fromEntries(SELECTION_KEYS.map((key) => [key, draft[key]])) as Record<string, string | undefined>,
    [draft],
  );
  const { data, loading, error, reload } = useWorkspaceContext(contextParams);

  useEffect(() => setDraft(urlSelection), [urlSelection]);

  useEffect(() => {
    const institution = (data as (WorkspaceContext & { institution?: InstitutionBrand }) | null)?.institution;
    if (institution && onInstitutionBrand) {
      onInstitutionBrand({
        name: institution.name || "",
        logoUrl: institution.logoUrl || null,
      });
    }
  }, [
    data,
    onInstitutionBrand,
  ]);

  function changeSelection(key: SelectionKey, value: string) {
    setDraft((current) => {
      const next: WorkspaceSelection = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      for (const dependent of RESET_DEPENDENTS[key] ?? []) delete next[dependent];
      return next;
    });
  }

  function applySelection(selection: WorkspaceSelection = draft) {
    router.replace(
      withQuerySelection(pathname, searchParams.toString(), selection),
      { scroll: false },
    );
  }

  if (loading && !data) {
    return (
      <section aria-label="Academic workspace context" className="mb-5 animate-pulse rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <div className="h-3 w-36 rounded bg-slate-200" />
        <div className="mt-3 h-5 w-64 max-w-full rounded bg-slate-100" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-11 rounded-xl bg-slate-100" />)}
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Academic workspace context</h2>
            <p role="alert" className="mt-1 text-sm text-amber-900">
              {error || "The current academic context is temporarily unavailable."}
            </p>
          </div>
          <button type="button" onClick={() => void reload()} className="min-h-10 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">
            Retry context
          </button>
        </div>
      </section>
    );
  }

  const children = data.children;
  const fixedScope = data.role === "STUDENT" || data.role === "PARENT";
  const hasOptions = Object.values(children).some((items) => items.length > 0);
  const showSelectors = !fixedScope && hasOptions;

  return (
    <section aria-label="Academic workspace context" className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Institutional workspace</p>
          <h2 className="mt-1 text-base font-extrabold text-slate-900">Academic context</h2>
          <p className="mt-1 text-sm text-slate-500">
            {fixedScope
              ? "Your academic context is determined by your linked enrollment or children."
              : "Choose the campus and academic group that should carry across workspace navigation."}
          </p>
        </div>
        {loading ? <span role="status" className="text-xs font-semibold text-slate-500">Updating options…</span> : null}
      </div>

      {data.breadcrumbs.length ? (
        <nav aria-label="Current institutional context" className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
          {data.breadcrumbs.map((item, index) => (
            <span key={item.id + item.type} className="inline-flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true" className="text-slate-300">›</span> : null}
              {index === data.breadcrumbs.length - 1
                ? <span className="text-slate-900">{item.label}</span>
                : <Link href={item.href} className="underline-offset-2 hover:text-emerald-700 hover:underline">{item.label}</Link>}
            </span>
          ))}
        </nav>
      ) : null}

      {showSelectors ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field
            label="Campus"
            value={draft.campusId ?? ""}
            placeholder="All available campuses"
            options={children.campuses.map((item) => ({ id: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
            onChange={(value) => changeSelection("campusId", value)}
          />
          <Field
            label="Department"
            value={draft.departmentId ?? ""}
            placeholder="All available departments"
            options={children.departments.map((item) => ({ id: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
            disabled={!children.departments.length}
            onChange={(value) => changeSelection("departmentId", value)}
          />
          <Field
            label="Programme"
            value={draft.programId ?? ""}
            placeholder="All available programmes"
            options={children.programs.map((item) => ({ id: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
            disabled={!children.programs.length}
            onChange={(value) => changeSelection("programId", value)}
          />
          <Field
            label="Academic year / session"
            value={draft.academicYearId ?? ""}
            placeholder="All available years"
            options={children.academicYears.map((item) => ({ id: item.id, label: `${item.name}${item.isCurrent ? " · Current" : ""}` }))}
            disabled={!children.academicYears.length}
            onChange={(value) => changeSelection("academicYearId", value)}
          />
          <Field
            label="Batch"
            value={draft.batchId ?? ""}
            placeholder="All available batches"
            options={children.batches.map((item) => ({ id: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
            disabled={!children.batches.length}
            onChange={(value) => changeSelection("batchId", value)}
          />
          <Field
            label="Semester"
            value={draft.semesterId ?? ""}
            placeholder="All available semesters"
            options={children.semesters.map((item) => ({ id: item.id, label: `${item.number}. ${item.name}` }))}
            disabled={!children.semesters.length}
            onChange={(value) => changeSelection("semesterId", value)}
          />
          <Field
            label="Section"
            value={draft.sectionId ?? ""}
            placeholder="All available sections"
            options={children.sections.map((item) => ({ id: item.id, label: item.name }))}
            disabled={!children.sections.length}
            onChange={(value) => changeSelection("sectionId", value)}
          />
        </div>
      ) : null}

      {error ? <p role="status" className="mt-3 text-sm font-semibold text-amber-800">{error}</p> : null}

      {showSelectors ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => {
              setDraft({});
              applySelection({});
            }}
            disabled={loading}
            className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
          >
            Clear selection
          </button>
          <button
            type="button"
            onClick={() => applySelection()}
            disabled={loading}
            className="min-h-10 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply workspace
          </button>
        </div>
      ) : null}
    </section>
  );
}
