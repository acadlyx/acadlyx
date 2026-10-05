"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DirectoryOption,
  searchCourseOfferings,
  searchLibraryStudents,
  searchStudents,
  searchUsers,
} from "@/lib/directoryApi";

type PickerKind = "student" | "user" | "courseOffering";

interface EntityPickerProps {
  kind: PickerKind;
  value: DirectoryOption | null;
  onChange: (option: DirectoryOption | null) => void;
  label: string;
  placeholder?: string;
  roles?: string[];
  disabled?: boolean;
  required?: boolean;
  /** Enables contextual department/program/session/semester/section filters. */
  structuredStudentSearch?: boolean;
}

export function EntityPicker({
  kind,
  value,
  onChange,
  label,
  placeholder,
  roles,
  disabled,
  required,
  structuredStudentSearch = false,
}: EntityPickerProps) {
  const [term, setTerm] = useState("");
  const [filters, setFilters] = useState({
    department: "",
    program: "",
    session: "",
    semester: "",
    section: "",
  });
  const [options, setOptions] = useState<DirectoryOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const roleKey = useMemo(() => (roles ? roles.join(",") : ""), [roles]);
  const structured = structuredStudentSearch && kind === "user";
  const hasStructuredFilter = Object.values(filters).some((value) => value.trim().length > 0);

  useEffect(() => {
    const canSearch = structured
      ? term.trim().length >= 2 || hasStructuredFilter
      : term.trim().length >= 2;

    if (!canSearch) {
      setOptions([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const query = term.trim();
        const results = structured
          ? await searchLibraryStudents({ search: query || undefined, ...filters })
          : kind === "student"
            ? await searchStudents(query)
            : kind === "courseOffering"
              ? await searchCourseOfferings(query)
              : await searchUsers(query, roleKey ? roleKey.split(",") : undefined);
        if (!cancelled) {
          setOptions(results);
          setOpen(true);
        }
      } catch (err) {
        if (!cancelled) {
          setOptions([]);
          setError(err instanceof Error ? err.message : "Search failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [term, kind, roleKey, structured, hasStructuredFilter, filters]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  if (value) {
    return (
      <div className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">{label}</span>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{value.label}</p>
            {value.hint && <p className="truncate text-xs text-slate-500">{value.hint}</p>}
          </div>
          {!disabled && (
            <button type="button" onClick={() => { onChange(null); setTerm(""); setOptions([]); }} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600">
              Change
            </button>
          )}
        </div>
      </div>
    );
  }

  const defaultPlaceholder = kind === "courseOffering"
    ? "Search course, department, program/class, semester or section"
    : "Type a name or code to search";

  return (
    <div ref={containerRef} className="relative text-sm">
      <label className="block">
        <span className="mb-1 block font-medium text-slate-600">{label}{required && <span className="ml-1 text-red-600">*</span>}</span>
        <input value={term} disabled={disabled} onChange={(event) => setTerm(event.target.value)} onFocus={() => options.length > 0 && setOpen(true)} placeholder={placeholder ?? defaultPlaceholder} className="w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-100" autoComplete="off" />
      </label>

      {structured && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          {([
            ["department", "Department / code"],
            ["program", "Program / code"],
            ["session", "Academic session"],
            ["semester", "Semester"],
            ["section", "Section"],
          ] as const).map(([key, labelText]) => (
            <input
              key={key}
              value={filters[key]}
              disabled={disabled}
              onChange={(event) => setFilters((previous) => ({ ...previous, [key]: event.target.value }))}
              placeholder={labelText}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
              autoComplete="off"
            />
          ))}
          <p className="col-span-2 text-[11px] text-slate-500">Filter by academic context first, then narrow by student name, enrollment or roll number.</p>
        </div>
      )}

      {term.trim().length > 0 && term.trim().length < 2 && !structured && <p className="mt-1 text-xs text-slate-500">Keep typing — at least two characters.</p>}
      {loading && <p className="mt-1 text-xs text-slate-500">Searching…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {options.map((option) => (
            <li key={option.id}>
              <button type="button" onClick={() => { onChange(option); setOpen(false); setTerm(""); setOptions([]); }} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                <span className="block font-semibold text-slate-900">{option.label}</span>
                {option.hint && <span className="block text-xs text-slate-500">{option.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && !error && options.length === 0 && (structured ? (term.trim().length >= 2 || hasStructuredFilter) : term.trim().length >= 2) && <p className="mt-1 text-xs text-slate-500">No matches in your authorized scope.</p>}
    </div>
  );
}

export default EntityPicker;
