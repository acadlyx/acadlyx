"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface HealthResponse {
  success: boolean;
  service: string;
  status: string;
  timestamp: string;
}

type ConnectionState = "loading" | "connected" | "error";

/**
 * Phase 0 landing page.
 * Its only job is to prove the frontend can reach the backend
 * health endpoint. Real dashboards arrive in later phases.
 */
export default function HomePage() {
  const [state, setState] = useState<ConnectionState>("loading");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    apiFetch<HealthResponse>("/health")
      .then((data) => {
        if (!isMounted) return;
        setHealth(data);
        setState("connected");
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setErrorMessage(err.message);
        setState("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-acadlyx-primary">
          ACADLYX
        </h1>
        <p className="mt-1 text-sm text-acadlyx-secondary">
          Education ERP &amp; Institutional Intelligence Platform
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-slate-200 p-4 text-sm">
        {state === "loading" && (
          <p className="text-slate-500">Checking backend connection…</p>
        )}

        {state === "connected" && health && (
          <div className="space-y-1">
            <p className="font-medium text-emerald-600">Backend connected</p>
            <p className="text-slate-500">service: {health.service}</p>
            <p className="text-slate-500">status: {health.status}</p>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-1">
            <p className="font-medium text-red-600">Backend unreachable</p>
            <p className="text-slate-500">{errorMessage}</p>
            <p className="text-slate-400">
              Make sure the API is running on the URL set in
              NEXT_PUBLIC_API_URL.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
