"use client";

import { ReactNode } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";

export function DetailDrawer({
  title,
  subtitle,
  eyebrow = "Record details",
  children,
  footer,
  onClose,
  editLabel = "Edit",
  onEdit,
  canEdit = false,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  editLabel?: string;
  onEdit?: () => void;
  canEdit?: boolean;
}) {
  return (
    <ModalPortal onBackdropClick={onClose} className="items-stretch justify-end p-0">
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="acadlyx-detail-drawer-title"
        className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden border-l border-slate-200 bg-white text-slate-900 shadow-[-18px_0_55px_rgba(15,23,42,0.18)] sm:w-[min(480px,92vw)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex min-h-[92px] shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              {eyebrow}
            </p>
            <h2
              id="acadlyx-detail-drawer-title"
              className="mt-1 break-words text-xl font-black leading-tight tracking-[-0.025em] text-slate-950 sm:text-2xl"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-xl font-medium leading-none text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="space-y-4">{children}</div>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          {footer ? (
            footer
          ) : (
            <div className="flex items-center justify-end gap-2">
              {canEdit && onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  {editLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Close
              </button>
            </div>
          )}
        </footer>
      </aside>
    </ModalPortal>
  );
}

export function DetailField({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-slate-900",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
  }[tone];

  return (
    <div className="border-b border-slate-100 py-3.5 last:border-b-0">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className={`mt-1 break-words text-sm font-semibold leading-5 ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}
