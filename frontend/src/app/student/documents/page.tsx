"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import {
  getMyDocuments,
  PortalDocument,
} from "@/lib/portalApi";

export default function StudentDocumentsPage() {
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await getMyDocuments());
    } catch (reason) {
      setError(
        reason instanceof AuthRequiredError
          ? "Your session has expired. Please sign in again."
          : reason instanceof Error
            ? reason.message
            : "Unable to load your documents.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell
      title="Documents"
      subtitle="Your institution documents and academic records"
      allowedRoles={["STUDENT"]}
    >
      <main className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/student"
            className="text-sm font-bold text-slate-600 hover:text-slate-900"
          >
            ← Back to dashboard
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {error ? (
          <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-bold text-red-900">Documents could not be loaded</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              Try again
            </button>
          </section>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200"
              />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-bold text-slate-900">No documents available</p>
            <p className="mt-1 text-sm text-slate-500">
              Documents published for your account will appear here.
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {documents.map((document) => (
                <article
                  key={document.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{document.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.type || "Document"} ·{" "}
                      {new Date(document.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Open document →
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </DashboardShell>
  );
}
