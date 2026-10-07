"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { DashboardShell } from "./DashboardShell";

type Opportunity = {
  id: string;
  title: string;
  organization: string;
  description: string | null;
  deadline: string | null;
  isActive: boolean;
  targetRole?: { id: string; name: string } | null;
};

type Application = {
  id: string;
  status: string;
  appliedAt: string;
  opportunity: { id: string; title: string; organization: string; deadline: string | null };
  student?: { id: string; firstName: string; lastName: string; email: string };
};

type Metrics = {
  opportunities: number;
  applications: number;
  status: Record<string, number>;
  organizations: Array<{ organization: string; opportunities: number }>;
  applicationSuccessRate: number;
};

export function PlacementDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isManager = user?.roles.includes("PLACEMENT") ?? false;
  const isStudent = user?.roles.includes("STUDENT") ?? false;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [current, opportunityResponse, applicationResponse, metricResponse] = await Promise.all([
        getCurrentUser(),
        apiFetch<{ data?: Opportunity[] }>("/placements/opportunities?activeOnly=false"),
        apiFetch<{ data?: Application[] }>("/placements/applications"),
        apiFetch<{ data?: Metrics }>("/placements/metrics"),
      ]);
      setUser(current);
      setOpportunities(opportunityResponse.data || []);
      setApplications(applicationResponse.data || []);
      setMetrics(metricResponse.data || null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to load placement workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId("create");
    setError("");
    try {
      await apiFetch("/placements/opportunities", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          organization: form.get("organization"),
          deadline: form.get("deadline") ? new Date(String(form.get("deadline"))).toISOString() : null,
          description: form.get("description") || undefined,
        }),
      });
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to create placement opportunity.");
    } finally {
      setBusyId(null);
    }
  }

  async function transition(applicationId: string, status: string) {
    setBusyId(applicationId);
    setError("");
    try {
      await apiFetch("/placements/applications/" + applicationId + "/status", {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to update application.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell title={isStudent ? "My Placement" : "Placement Workspace"} subtitle={isStudent ? "Eligible opportunities and your application progress" : "Employer opportunities, applications and placement outcomes"} allowedRoles={["PLACEMENT", "STUDENT"]}>
      <div className="mx-auto min-w-0 max-w-7xl space-y-6">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Career services</p>
              <h1 className="mt-2 break-words text-2xl font-black sm:text-3xl text-slate-950">Placement Command Center</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {isStudent ? "Your placement opportunities and application history are scoped to your own student record. Eligibility and application actions are enforced by the server." : "This workspace is connected to the institutional placement opportunity and application records. Every application transition is server-authorized and audited."}
              </p>
            </div>
            <button onClick={() => void load()} className="min-h-11 w-full rounded-xl border px-4 py-2 text-sm font-bold text-slate-800 sm:w-auto" disabled={loading}>Refresh</button>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Active opportunities", metrics?.opportunities ?? 0],
            ["Applications", metrics?.applications ?? 0],
            ["Offered", metrics?.status.OFFERED ?? 0],
            ["Success rate", (metrics?.applicationSuccessRate ?? 0) + "%"],
          ].map(([label, value]) => (
            <article key={String(label)} className="rounded-2xl border bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{loading ? "—" : value}</p>
            </article>
          ))}
        </section>

        {isManager && (
          <form onSubmit={createOpportunity} className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Publish employer opportunity</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input name="title" required placeholder="Job / opportunity title" className="rounded-xl border px-4 py-3" />
              <input name="organization" required placeholder="Company / organization" className="rounded-xl border px-4 py-3" />
              <input name="deadline" type="datetime-local" className="rounded-xl border px-4 py-3" />
              <input name="description" placeholder="Short description" className="rounded-xl border px-4 py-3" />
            </div>
            <button disabled={busyId === "create"} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              {busyId === "create" ? "Publishing…" : "Publish opportunity"}
            </button>
          </form>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black text-slate-950">Employer opportunities</h2><span className="text-xs text-slate-500">{opportunities.length} records</span></div>
            <div className="mt-4 space-y-3">
              {opportunities.map((item) => (
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div className="min-w-0"><p className="font-bold text-slate-950">{item.title}</p><p className="text-sm text-slate-600">{item.organization}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{item.isActive ? "ACTIVE" : "CLOSED"}</span></div>
                  {item.deadline && <p className="mt-2 text-xs text-slate-500">Deadline: {new Date(item.deadline).toLocaleString()}</p>}
                  {item.description && <p className="mt-2 text-sm text-slate-600">{item.description}</p>}
                </div>
              ))}
              {!loading && opportunities.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No placement opportunities have been published.</p>}
            </div>
          </article>

          <article className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-950">Application pipeline</h2><span className="text-xs text-slate-500">{applications.length} records</span></div>
            <div className="mt-4 space-y-3">
              {applications.map((item) => (
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="flex justify-between gap-3"><div><p className="font-bold text-slate-950">{item.opportunity.title}</p><p className="text-sm text-slate-600">{item.opportunity.organization}{item.student ? " · " + item.student.firstName + " " + item.student.lastName : ""}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{item.status}</span></div>
                  {isManager && ["APPLIED","SHORTLISTED","INTERVIEW","OFFERED","ACCEPTED"].includes(item.status) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status === "APPLIED" && <button onClick={() => void transition(item.id, "SHORTLISTED")} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold">Shortlist</button>}
                      {item.status === "SHORTLISTED" && <button onClick={() => void transition(item.id, "INTERVIEW")} className="rounded-lg border px-3 py-2 text-xs font-bold">Move to interview</button>}
                      {item.status === "INTERVIEW" && <button onClick={() => void transition(item.id, "OFFERED")} className="rounded-lg border px-3 py-2 text-xs font-bold">Offer</button>}
                      {item.status === "OFFERED" && <button onClick={() => void transition(item.id, "ACCEPTED")} className="rounded-lg border px-3 py-2 text-xs font-bold">Accept</button>}
                      {item.status === "ACCEPTED" && <button onClick={() => void transition(item.id, "JOINED")} className="min-h-11 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Mark joined</button>}
                      {["APPLIED","SHORTLISTED","INTERVIEW","OFFERED"].includes(item.status) && <button onClick={() => void transition(item.id, "REJECTED")} className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject</button>}
                    </div>
                  )}
                </div>
              ))}
              {!loading && applications.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No placement applications yet.</p>}
            </div>
          </article>
        </section>
      </div>
    </DashboardShell>
  );
}
