"use client";

import { ReactNode } from "react";
import { WorkflowState } from "@/lib/workflowState";

export function ActionStateButton({
  state,
  busy = false,
  onAction,
  className = "",
  children,
}: {
  state: WorkflowState;
  busy?: boolean;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const isBusy = busy || state.status === "IN_PROGRESS";
  const label =
    isBusy
      ? "Working…"
      : children ??
        (state.canAct
          ? state.nextActionLabel ?? "Continue"
          : state.nextActionLabel ?? state.label);

  return (
    <button
      type="button"
      disabled={isBusy || !state.canAct || !onAction}
      aria-disabled={isBusy || !state.canAct}
      aria-busy={isBusy}
      onClick={onAction}
      className={className}
    >
      {label}
    </button>
  );
}
