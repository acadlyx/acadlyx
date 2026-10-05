"use client";

import { useEffect, useState } from "react";
import {
  searchDirectoryCourseOfferings,
  searchDirectoryStudents,
  searchDirectoryUsers,
  type DirectoryOption,
} from "@/lib/erpApi";

type DirectoryKind = "student" | "user" | "course-offering";

export function DirectoryPicker({
  kind,
  value,
  onChange,
  placeholder,
  roles,
  disabled = false,
}: {
  kind: DirectoryKind;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  roles?: string[];
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DirectoryOption[]>([]);
  const [selected, setSelected] = useState<DirectoryOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const match = options.find((option) => option.id === value);
    if (match) setSelected(match);
  }, [value, options]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result =
          kind === "student"
            ? await searchDirectoryStudents(trimmed)
            : kind === "user"
              ? await searchDirectoryUsers(trimmed, roles)
              : await searchDirectoryCourseOfferings(trimmed);
        if (!cancelled) setOptions(result);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kind, query, roles?.join(",")]);

  return (
    <div className="relative">
      {selected && !opened ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpened(true);
            setQuery(selected.label);
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm disabled:opacity-50"
        >
          <span className="block font-semibold text-slate-900">{selected.label}</span>
          {selected.hint && <span className="block text-xs text-slate-500">{selected.hint}</span>}
        </button>
      ) : (
        <input
          autoFocus={opened}
          disabled={disabled}
          value={query}
          onFocus={() => setOpened(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) onChange("");
          }}
          placeholder={placeholder || "Search by name, code or identifier…"}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
        />
      )}

      {opened && query.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {loading ? (
            <div className="px-3 py-3 text-sm text-slate-500">Searching…</div>
          ) : options.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">No matching records.</div>
          ) : (
            options.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setSelected(option);
                  setQuery("");
                  setOpened(false);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                {option.hint && <span className="block text-xs text-slate-500">{option.hint}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
