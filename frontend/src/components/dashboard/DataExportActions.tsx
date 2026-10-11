"use client";

import { useState } from "react";
import { ExportFormat, ExportOptions, ExportType, exportData, printExport } from "@/lib/dataTransferApi";

export interface DataExportActionsProps {
  type: ExportType;
  filters?: Record<string, string>;
  currentPage?: { page: number; pageSize: number };
  selectedIds?: string[];
  compact?: boolean;
}

export default function DataExportActions({
  type,
  filters = {},
  currentPage,
  selectedIds,
  compact = false,
}: DataExportActionsProps) {
  const [selection, setSelection] = useState<"all-filtered" | "current-page" | "selected">("all-filtered");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const options = (): ExportOptions => ({
    selection,
    filters,
    ...(selection === "current-page" && currentPage ? currentPage : {}),
    ...(selection === "selected" ? { ids: selectedIds || [] } : {}),
  });

  async function run(format: ExportFormat | "print") {
    setBusy(true);
    setMessage("");
    try {
      const requestOptions = options();
      if (format === "print") await printExport(type, requestOptions);
      else await exportData(type, format, requestOptions);
      setMessage(format === "print" ? "Print view opened." : "Export downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={compact ? "flex flex-wrap items-center gap-2" : "rounded-2xl border border-slate-200 bg-white p-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          Export scope
          <select
            aria-label="Export scope"
            value={selection}
            onChange={(event) => setSelection(event.target.value as typeof selection)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-800"
          >
            <option value="all-filtered">All filtered records</option>
            {currentPage && <option value="current-page">Current page ({currentPage.page})</option>}
            {selectedIds !== undefined && <option value="selected" disabled={selectedIds.length === 0}>Selected rows ({selectedIds.length})</option>}
          </select>
        </label>
        {(["xlsx", "csv", "docx", "pdf", "json"] as const).map((format) => (
          <button
            key={format}
            type="button"
            disabled={busy || (selection === "current-page" && !currentPage) || (selection === "selected" && !selectedIds?.length)}
            onClick={() => void run(format)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-black uppercase text-slate-800 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Preparing…" : format === "xlsx" ? "XLSX" : format.toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          disabled={busy || (selection === "current-page" && !currentPage) || (selection === "selected" && !selectedIds?.length)}
          onClick={() => void run("print")}
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-black text-slate-800 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Print
        </button>
      </div>
      {message && <p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}
    </section>
  );
}
