"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AttendanceExportPanel } from "@/components/attendance/AttendanceExportPanel";
import DataExportActions from "@/components/dashboard/DataExportActions";
import { AuthRequiredError, authedFetch, getCachedCurrentUser, getCurrentUser, type AuthUser } from "@/lib/auth";

type ReportId = "finance" | "admissions" | "hr" | "placement" | "library" | "examinations" | "intelligence";
type ReportState = { status: "loading" | "ready" | "error"; payload?: unknown; error?: string };
type ReportSource = { id: ReportId; title: string; endpoint: string };
type Metric = { label: string; value: string | number; kind?: "money" | "percent" };

type ApiShape = {
  envelope: Record<string, unknown>;
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
  summary: Record<string, unknown>;
  list: unknown[];
};

const has = (user: AuthUser, ...permissions: string[]) => permissions.some((permission) => user.permissions.includes(permission));
const field = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
const label = "text-xs font-bold text-slate-600";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function apiShape(value: unknown): ApiShape {
  const envelope = object(value);
  const list = Array.isArray(envelope.data) ? envelope.data : [];
  const nested = object(envelope.data);
  return {
    envelope,
    data: Object.keys(nested).length ? nested : {},
    meta: object(envelope.meta),
    summary: object(envelope.summary),
    list,
  };
}

function numberAt(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function metric(label: string, value: unknown, kind?: Metric["kind"]): Metric | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return { label, value, kind };
}

function money(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatMetric(value: Metric): string {
  if (value.kind === "money") return money(Number(value.value));
  if (value.kind === "percent") return `${Number(value.value).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
  return typeof value.value === "number" ? value.value.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : value.value;
}

function reportMetrics(id: ReportId, payload: unknown): Metric[] {
  const shape = apiShape(payload);
  const data = shape.data;
  const summary = shape.summary;
  const out: Array<Metric | null> = [];

  if (id === "finance") {
    for (const [name, key, kind] of [
      ["Billed", "billed", "money"], ["Collected", "collected", "money"],
      ["Outstanding", "outstanding", "money"], ["Overdue", "overdue", "money"],
      ["Invoices pending", "pendingInvoices", undefined], ["Refunds awaiting review", "pendingRefunds", undefined],
      ["Concessions awaiting review", "pendingConcessions", undefined],
    ] as const) out.push(metric(name, data[key], kind));
  } else if (id === "admissions") {
    out.push(metric("Applications in scope", numberAt(shape.meta, "total")));
    const statuses = Object.entries(summary).filter((entry): entry is [string, number] => typeof entry[1] === "number").slice(0, 5);
    for (const [status, count] of statuses) out.push(metric(status.replace(/_/g, " ").toLowerCase(), count));
  } else if (id === "hr") {
    out.push(metric("Employees in scope", numberAt(shape.meta, "total")));
    out.push(metric("Departments represented", numberAt(summary, "departments")));
    const statuses = object(summary.byStatus);
    for (const [status, count] of Object.entries(statuses).filter((entry): entry is [string, number] => typeof entry[1] === "number").slice(0, 4)) {
      out.push(metric(status.replace(/_/g, " ").toLowerCase(), count));
    }
  } else if (id === "placement") {
    for (const [name, key, kind] of [
      ["Drives", "drives", undefined], ["Open drives", "openDrives", undefined], ["Companies", "companies", undefined],
      ["Applications", "applications", undefined], ["Offers", "offers", undefined], ["Students placed", "placedStudents", undefined],
      ["Placement rate", "placementRate", "percent"], ["Offer acceptance", "offerAcceptanceRate", "percent"],
      ["Average package", "averagePackage", "money"],
    ] as const) out.push(metric(name, data[key], kind));
  } else if (id === "library") {
    for (const [name, key, kind] of [
      ["Book titles", "titles", undefined], ["Total copies", "totalCopies", undefined], ["Available copies", "availableCopies", undefined],
      ["Currently issued", "issued", undefined], ["Overdue loans", "overdue", undefined], ["Damaged copies", "damaged", undefined],
      ["Outstanding fines", "outstandingFines", "money"], ["Fines collected", "collectedFines", "money"],
      ["Issued today", "todayIssues", undefined], ["Returned today", "todayReturns", undefined],
    ] as const) out.push(metric(name, data[key], kind));
  } else if (id === "examinations") {
    out.push(metric("Examination sessions in scope", numberAt(shape.meta, "total")));
    out.push(metric("Sessions returned on this page", shape.list.length));
  } else if (id === "intelligence") {
    const kpis = object(data.kpis);
    for (const [name, key, kind] of [
      ["Students", "students", undefined], ["Faculty", "faculty", undefined], ["Departments", "departments", undefined],
      ["Attendance", "attendance", "percent"], ["Pending assignments", "pendingAssignments", undefined],
    ] as const) out.push(metric(name, kpis[key], kind));
    if (Array.isArray(data.atRiskStudents)) out.push(metric("Students flagged for review", data.atRiskStudents.length));
    if (Array.isArray(data.recommendedActions)) out.push(metric("Operational priorities", data.recommendedActions.length));
  }

  return out.filter((value): value is Metric => value !== null);
}

function reportDetail(id: ReportId, payload: unknown): string | null {
  const shape = apiShape(payload);
  if (id === "intelligence") {
    const actions = shape.data.recommendedActions;
    if (Array.isArray(actions) && actions.length) return actions.filter((x): x is string => typeof x === "string").slice(0, 3).join(" · ");
    return "No current operational priorities were returned for this authorized scope.";
  }
  if (id === "admissions" && shape.meta.total === 0) return "No applications were returned for the current authorized scope.";
  if (id === "hr" && shape.meta.total === 0) return "No employee records were returned for the current authorized scope.";
  if (id === "examinations" && shape.meta.total === 0) return "No examination sessions were returned for the current authorized scope.";
  return null;
}

function ReportCard({
  title, state, onRetry, children,
}: {
  title: string;
  state?: ReportState;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {state?.status === "loading" ? "Loading authorized records…" : state?.status === "error" ? "This source did not return a report." : "Live data from the existing ACADLYX service."}
          </p>
        </div>
        <button type="button" onClick={onRetry} disabled={state?.status === "loading"} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Refresh</button>
      </div>
      {state?.status === "loading" ? <div role="status" className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Loading…</div> : null}
      {state?.status === "error" ? <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{state.error || "The service could not provide this report."}</p><p className="mt-1 text-xs">Missing or unauthorized data is not represented as zero.</p></div> : null}
      {state?.status === "ready" ? children : null}
    </section>
  );
}

export function RoleScopedReports({
  role,
  title,
  subtitle,
}: {
  role: string;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(() => getCachedCurrentUser());
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [financePeriod, setFinancePeriod] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [reports, setReports] = useState<Partial<Record<ReportId, ReportState>>>({});

  useEffect(() => {
    let active = true;
    void getCurrentUser({ force: true }).then((current) => {
      if (active) { setUser(current); setAuthError(""); }
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof AuthRequiredError) { router.replace("/login"); return; }
      setAuthError(error instanceof Error ? error.message : "Could not verify the current session.");
    }).finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, [router]);

  const sources = useMemo<ReportSource[]>(() => {
    if (!user) return [];
    const found: ReportSource[] = [];
    if (has(user, "fees.read", "fees.collection.read")) {
      found.push({ id: "finance", title: "Finance & fees", endpoint: `/finance/command-center?period=${encodeURIComponent(financePeriod)}` });
    }
    if (has(user, "admissions.read")) found.push({ id: "admissions", title: "Admissions pipeline", endpoint: "/admissions?page=1&pageSize=1" });
    if (has(user, "hr.read")) found.push({ id: "hr", title: "Workforce & HR", endpoint: "/hr/employees?page=1&pageSize=1" });
    if (has(user, "placements.read")) found.push({ id: "placement", title: "Placement outcomes", endpoint: "/placements/metrics" });
    if (role === "LIBRARIAN" && has(user, "library.read")) found.push({ id: "library", title: "Library circulation & inventory", endpoint: "/library/summary" });
    if (has(user, "exams.read")) found.push({ id: "examinations", title: "Examination operations", endpoint: "/examinations/sessions?page=1&pageSize=1" });
    if (has(user, "intelligence.read")) {
      const query = new URLSearchParams();
      if (from) query.set("from", new Date(from + "T00:00:00").toISOString());
      if (to) query.set("to", new Date(to + "T23:59:59.999").toISOString());
      found.push({ id: "intelligence", title: "Institutional intelligence", endpoint: "/intelligence/command-center" + (query.size ? "?" + query.toString() : "") });
    }
    return found;
  }, [user, role, financePeriod, from, to]);

  useEffect(() => {
    if (!user || authLoading) return;
    let active = true;
    if (!sources.length) { setReports({}); return () => { active = false; }; }
    setReports(Object.fromEntries(sources.map((source) => [source.id, { status: "loading" as const }])));
    void Promise.all(sources.map(async (source) => {
      try {
        const payload = await authedFetch<unknown>(source.endpoint);
        if (active) setReports((previous) => ({ ...previous, [source.id]: { status: "ready", payload } }));
      } catch (error) {
        if (!active) return;
        if (error instanceof AuthRequiredError) router.replace("/login");
        setReports((previous) => ({ ...previous, [source.id]: { status: "error", error: error instanceof Error ? error.message : "Report request failed." } }));
      }
    }));
    return () => { active = false; };
  }, [user, authLoading, sources, refreshRevision, router]);

  const refresh = useCallback((id?: ReportId) => {
    if (id && reports[id]?.status === "error") {
      setReports((previous) => ({ ...previous, [id]: { status: "loading" } }));
      const source = sources.find((candidate) => candidate.id === id);
      if (source) {
        void authedFetch<unknown>(source.endpoint).then((payload) => setReports((previous) => ({ ...previous, [id]: { status: "ready", payload } }))).catch((error: unknown) => {
          if (error instanceof AuthRequiredError) router.replace("/login");
          setReports((previous) => ({ ...previous, [id]: { status: "error", error: error instanceof Error ? error.message : "Report request failed." } }));
        });
        return;
      }
    }
    setRefreshRevision((value) => value + 1);
  }, [reports, router, sources]);

  const permissions = user?.permissions || [];
  const readyToReport = !authLoading && Boolean(user) && !authError;
  const hasReportSource = sources.length > 0;

  return (
    <DashboardShell title={title} subtitle={subtitle} allowedRoles={[role]}>
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{role.replace(/_/g, " ")} reporting workspace</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Institutional reports</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Each report is loaded from its existing backend domain and filtered by the active server-side role, institution and academic scope. Missing or denied source data is shown as unavailable, never replaced with sample values.</p>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            {permissions.some((permission) => permission === "fees.read" || permission === "fees.collection.read") ? <label className="min-w-44"><span className={label}>Finance period</span><select className={field} value={financePeriod} onChange={(event) => setFinancePeriod(event.target.value)}><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">This month</option><option value="quarter">This quarter</option><option value="academic">Current academic year</option></select></label> : null}
            {has(user as AuthUser, "intelligence.read") ? <><label><span className={label}>Intelligence from</span><input type="date" className={field} value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label><span className={label}>To</span><input type="date" className={field} value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label></> : null}
            <button type="button" disabled={!readyToReport} onClick={() => refresh()} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Refresh reports</button>
          </div>
          {authError ? <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{authError}</p> : null}
        </section>

        {!readyToReport ? <section role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">{authLoading ? "Verifying your session and report permissions…" : "Your reporting session could not be verified. Retry by reloading this page."}</section> : null}
        {readyToReport && !hasReportSource ? <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-black text-slate-950">No report services are granted</h2><p className="mt-2 text-sm text-slate-600">The authenticated session has no matching report-read permission for these domain summaries.</p></section> : null}

        {readyToReport ? sources.map((source) => {
          const state = reports[source.id];
          const metrics = state?.status === "ready" ? reportMetrics(source.id, state.payload) : [];
          const detail = state?.status === "ready" ? reportDetail(source.id, state.payload) : null;
          return <ReportCard key={source.id} title={source.title} state={state} onRetry={() => refresh(source.id)}>
            {metrics.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((item) => <article key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold capitalize text-slate-500">{item.label}</p><p className="mt-2 text-xl font-black tracking-tight text-slate-950">{formatMetric(item)}</p></article>)}</div> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{detail || "The authorized endpoint did not return summary metrics for this view. No values have been fabricated."}</p>}
            {detail && metrics.length ? <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p> : null}
            <div className="mt-4">
              {source.id === "finance" && has(user!, "fees.read") ? <DataExportActions type={["fees", "fee-payments", "fee-structures", "outstanding-dues", "fee-refunds"]} compact /> : null}
              {source.id === "admissions" ? <DataExportActions type="admission-applications" compact /> : null}
              {source.id === "hr" ? <DataExportActions type={["employees", "leave-requests"]} compact /> : null}
              {source.id === "placement" ? <DataExportActions type={["placement-drives", "placement-applications", "placement-offers"]} compact /> : null}
              {source.id === "library" ? <DataExportActions type={["library-books", "library-copies", "library-issues", "library-fines"]} compact /> : null}
              {source.id === "examinations" ? <DataExportActions type={["exams", "marks"]} compact /> : null}
            </div>
          </ReportCard>;
        }) : null}

        {readyToReport && has(user!, "attendance.read") ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-4 text-lg font-black text-slate-950">Attendance report & export</h2><AttendanceExportPanel /></section> : null}
      </main>
    </DashboardShell>
  );
}
