"use client";

import { useEffect, useState } from "react";

export type WorkflowStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED"
  | "EXPIRED"
  | (string & {});

export interface WorkflowState {
  status: WorkflowStatus;
  label: string;
  nextActionLabel?: string;
  canAct: boolean;
  terminal?: boolean;
}

type Listener = () => void;

class WorkflowStateRegistry {
  private readonly states = new Map<string, WorkflowState>();
  private readonly listeners = new Map<string, Set<Listener>>();

  get(key: string): WorkflowState | undefined {
    return this.states.get(key);
  }

  set(key: string, state: WorkflowState): void {
    this.states.set(key, state);
    this.listeners.get(key)?.forEach((listener) => listener());
  }

  clear(key: string): void {
    this.states.delete(key);
    this.listeners.get(key)?.forEach((listener) => listener());
  }

  subscribe(key: string, listener: Listener): () => void {
    const listeners = this.listeners.get(key) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(key);
    };
  }
}

export const workflowStateRegistry = new WorkflowStateRegistry();

export function enrollmentWorkflowKey(studentId: string): string {
  return `student:${studentId}:enrollment`;
}

export function resolveEnrollmentWorkflowState(
  enrollment:
    | {
        id?: string | null;
        status?: string | null;
      }
    | null
    | undefined,
): WorkflowState {
  if (!enrollment) {
    return {
      status: "NOT_STARTED",
      label: "Not enrolled",
      nextActionLabel: "Enroll",
      canAct: true,
    };
  }

  const status = String(enrollment.status || "").toUpperCase();

  if (status === "ACTIVE") {
    return {
      status: "COMPLETED",
      label: "Enrolled",
      nextActionLabel: "View Enrollment",
      canAct: false,
      terminal: true,
    };
  }

  if (status === "COMPLETED") {
    return {
      status: "COMPLETED",
      label: "Completed",
      nextActionLabel: "View Enrollment",
      canAct: false,
      terminal: true,
    };
  }

  if (status === "DROPPED" || status === "TRANSFERRED") {
    return {
      status,
      label: status === "DROPPED" ? "Dropped" : "Transferred",
      nextActionLabel: "Manage Enrollment",
      canAct: true,
    };
  }

  return {
    status: "PENDING",
    label: status.replaceAll("_", " ") || "Pending",
    nextActionLabel: "Manage Enrollment",
    canAct: true,
  };
}

export function publishEnrollmentState(
  studentId: string,
  enrollment:
    | {
        id?: string | null;
        status?: string | null;
      }
    | null
    | undefined,
): WorkflowState {
  const state = resolveEnrollmentWorkflowState(enrollment);
  workflowStateRegistry.set(enrollmentWorkflowKey(studentId), state);
  return state;
}

export function useWorkflowState(
  key: string,
  authoritativeState: WorkflowState,
): WorkflowState {
  const [registryState, setRegistryState] = useState<WorkflowState | undefined>(
    () => workflowStateRegistry.get(key),
  );

  useEffect(() => {
    const unsubscribe = workflowStateRegistry.subscribe(key, () => {
      setRegistryState(workflowStateRegistry.get(key));
    });
    workflowStateRegistry.set(key, authoritativeState);
    return unsubscribe;
  }, [key, authoritativeState]);

  return registryState ?? authoritativeState;
}
