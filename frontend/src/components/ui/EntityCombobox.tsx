"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Entity = Record<string, unknown> & { id?: string };

type Props = {
  value: string;
  options: Entity[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  getLabel?: (entity: Entity) => string;
  getSearchText?: (entity: Entity) => string;
};

const labelOf = (entity: Entity) => {
  const name = String(entity.name ?? entity.title ?? "").trim();
  const code = String(entity.code ?? "").trim();
  if (code && name) return `${code} — ${name}`;
  return name || String(entity.email ?? entity.id ?? "Unnamed");
};

export function EntityCombobox({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = "Search…",
  disabled = false,
  loading = false,
  emptyMessage = "No matching records found.",
  getLabel = labelOf,
  getSearchText = (entity) => `${getLabel(entity)} ${String(entity.email ?? "")} ${String(entity.id ?? "")}`,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => String(option.id ?? "") === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options.slice(0, 50);
    return options
      .filter((option) => getSearchText(option).toLowerCase().includes(normalized))
      .slice(0, 50);
  }, [options, query, getSearchText]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "truncate" : "truncate text-slate-400"}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="shrink-0 text-slate-400">⌄</span>
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 right-0 z-[70] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5" role="listbox">
            {loading ? (
              <p className="px-3 py-4 text-sm text-slate-500">Loading options…</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">{emptyMessage}</p>
            ) : (
              filtered.map((option) => {
                const id = String(option.id ?? "");
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id);
                      setQuery("");
                      setOpen(false);
                    }}
                    className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-blue-50 ${id === value ? "bg-blue-50 font-bold text-blue-700" : "text-slate-700"}`}
                    role="option"
                    aria-selected={id === value}
                  >
                    {getLabel(option)}
                  </button>
                );
              })
            )}
          </div>
          {value ? (
            <div className="border-t border-slate-100 p-2">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setQuery("");
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                Clear selection
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
