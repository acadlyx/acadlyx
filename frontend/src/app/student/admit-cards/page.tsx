"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  getHallTicket,
  getStudentExaminations,
  HallTicketView,
} from "@/lib/examinationsApi";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "—";
}

function printAdmitCard() {
  if (typeof window !== "undefined") window.print();
}

export default function StudentAdmitCardsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<string[]>([]);
  const [tickets, setTickets] = useState<Record<string, HallTicketView>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const user = await getCurrentUser();
      if (!user.roles.includes("STUDENT")) {
        router.replace("/");
        return;
      }

      const data = await getStudentExaminations(user.id);
      const ids = Array.from(
        new Set(
          data.upcoming
            .map((exam) => text(exam.examSessionId))
            .filter((id) => id !== "—"),
        ),
      );
      setSessions(ids);

      const results = await Promise.allSettled(
        ids.map(async (sessionId) => [sessionId, await getHallTicket(sessionId, user.id)] as const),
      );

      const next: Record<string, HallTicketView> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          next[result.value[0]] = result.value[1];
        }
      }
      setTickets(next);
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to load admit cards.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const available = useMemo(
    () => sessions.map((id) => tickets[id]).filter(Boolean),
    [sessions, tickets],
  );

  async function refreshTicket(sessionId: string) {
    setBusy(sessionId);
    setError("");
    try {
      const user = await getCurrentUser();
      const ticket = await getHallTicket(sessionId, user.id);
      setTickets((current) => ({ ...current, [sessionId]: ticket }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load this admit card.");
    } finally {
      setBusy("");
    }
  }

  return (
    <DashboardShell
      title="Admit Cards"
      subtitle="Download or print your released examination admit cards"
      allowedRoles={["STUDENT"]}
    >
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@media print { body * { visibility: hidden !important; } .acadlyx-admit-card-print, .acadlyx-admit-card-print * { visibility: visible !important; } .acadlyx-admit-card-print { position: absolute !important; inset: 0 !important; width: 100% !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; } }",
        }}
      />

      <main className="mx-auto w-full max-w-5xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                Examination documents
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">My Admit Cards</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Only examination sessions for which a hall ticket has been issued and released to you are shown here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4">
            {[1, 2].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-3xl bg-slate-200" />
            ))}
          </div>
        ) : available.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <h2 className="text-lg font-black text-slate-900">No released admit cards</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Your examination cell has not released an admit card for an upcoming examination yet.
            </p>
          </section>
        ) : (
          available.map((ticket) => (
            <article
              key={ticket.ticket.id}
              className="acadlyx-admit-card-print overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                    ACADLYX Examination Admit Card
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{ticket.session.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.session.code} · {ticket.session.examType}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Serial number</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{ticket.ticket.serialNumber}</p>
                  <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700">
                    {ticket.ticket.status}
                  </span>
                </div>
              </header>

              <div className="grid gap-3 p-6 sm:grid-cols-3">
                <Info
                  label="Examination period"
                  value={ticket.session.startDate.slice(0, 10) + " to " + ticket.session.endDate.slice(0, 10)}
                />
                <Info label="Issued" value={new Date(ticket.ticket.issuedAt).toLocaleDateString("en-IN")} />
                <Info label="Papers" value={String(ticket.papers.length)} />
              </div>

              {ticket.session.instructions ? (
                <div className="mx-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <strong>Instructions:</strong> {ticket.session.instructions}
                </div>
              ) : null}

              <div className="space-y-3 p-6">
                {ticket.papers.map((paper) => (
                  <div key={paper.examScheduleId} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          {paper.courseCode} · {paper.courseName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(paper.examDate).toLocaleDateString("en-IN")} · {paper.startTime}–{paper.endTime}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-black text-slate-900">Seat {paper.seatNumber}</p>
                        <p className="mt-1 text-slate-500">
                          {paper.roomName}{paper.building ? " · " + paper.building : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-5">
                <button
                  type="button"
                  onClick={() => void refreshTicket(ticket.session.id)}
                  disabled={busy === ticket.session.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {busy === ticket.session.id ? "Refreshing…" : "Refresh card"}
                </button>
                <button
                  type="button"
                  onClick={printAdmitCard}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-600"
                >
                  Download / Print PDF
                </button>
              </footer>
            </article>
          ))
        )}
      </main>
    </DashboardShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}
