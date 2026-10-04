"use client";

import { useCallback, useRef, useState } from "react";
import { apiFetch, createMutationKey } from "../lib/api";

export type MutationStatus = "idle" | "submitting" | "success" | "error";

export function useMutationState<TResponse = unknown>(mutationName = "mutation") {
  const [status, setStatus] = useState<MutationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TResponse | null>(null);
  const keyRef = useRef<string | null>(null);

  const run = useCallback(
    async (path: string, init?: RequestInit): Promise<TResponse> => {
      if (status === "submitting") {
        throw new Error("This action is already being processed.");
      }

      setStatus("submitting");
      setError(null);
      const key = keyRef.current ?? createMutationKey(mutationName);
      keyRef.current = key;

      try {
        const headers = new Headers(init?.headers);
        headers.set("X-Idempotency-Key", key);
        const result = await apiFetch<TResponse>(path, { ...init, headers });
        setData(result);
        setStatus("success");
        keyRef.current = null;
        return result;
      } catch (cause) {
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "The action failed. Please try again.");
        throw cause;
      }
    },
    [mutationName, status],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setData(null);
    keyRef.current = null;
  }, []);

  return {
    run,
    reset,
    status,
    data,
    error,
    isSubmitting: status === "submitting",
    isSuccess: status === "success",
    isError: status === "error",
  };
}
