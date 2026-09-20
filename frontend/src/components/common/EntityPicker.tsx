"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DirectoryOption,
  searchCourseOfferings,
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
  /** Only meaningful for kind="user" — narrows the searched roles. */
  roles?: string[];
  disabled?: boolean;
  required?: boolean;
}

/**
 * Searchable, permission-aware entity selector.
 *
 * Replaces every "paste a UUID" field. The options come from the
 * directory endpoints, which apply the same scope rules as the endpoint
 * the chosen id will be used against — so a faculty member searching
 * students sees only the ones they teach.
 *
 * The selection is a convenience, not an authorization: the backend
 * re-checks whatever id is submitted.
 */
export function EntityPicker({
  kind,
  value,
  onChange,
  label,
  placeholder,
  roles,
  disabled,
  required,
}: EntityPickerProps) {
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<DirectoryOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const roleKey = useMemo(() => (roles ? roles.join(",") : ""), [roles]);

  useEffect(() => {
    // Below two characters the API refuses the lookup by design, so
    // don't even issue the request.
    if (term.trim().length < 2) {
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
        const results =
          kind === "student"
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
  }, [term, kind, roleKey]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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
            <p className="truncate font-semibold text-slate-900">
              {value.label}
            </p>
            {value.hint && (
              <p className="truncate text-xs text-slate-500">{value.hint}</p>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setTerm("");
                setOptions([]);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Change
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative text-sm">
      <label className="block">
        <span className="mb-1 block font-medium text-slate-600">
          {label}
          {required && <span className="ml-1 text-red-600">*</span>}
        </span>
        <input
          value={term}
          disabled={disabled}
          onChange={(event) => setTerm(event.target.value)}
          onFocus={() => options.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Type a name or code to search"}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-100"
          autoComplete="off"
        />
      </label>

      {term.trim().length > 0 && term.trim().length < 2 && (
        <p className="mt-1 text-xs text-slate-500">
          Keep typing — at least two characters.
        </p>
      )}
      {loading && <p className="mt-1 text-xs text-slate-500">Searching…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                  setTerm("");
                }}
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="block font-semibold text-slate-900">
                  {option.label}
                </span>
                {option.hint && (
                  <span className="block text-xs text-slate-500">
                    {option.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && !error && options.length === 0 && term.trim().length >= 2 && (
        <p className="mt-1 text-xs text-slate-500">
          No matches you have access to.
        </p>
      )}
    </div>
  );
}

export default EntityPicker;
