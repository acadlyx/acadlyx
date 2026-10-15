"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { PlacementTeamShell } from "@/components/placement/PlacementTeamShell";
import DataExportActions from "@/components/dashboard/DataExportActions";

type Metrics = {
  companies?: number; drives?: number; openDrives?: number; applications?: number; offers?: number;
  acceptedOffers?: number; joinedOffers?: number; eligibleStudents?: number; unplacedStudents?: number;
  placementRate?: number; averagePackage?: number; highestPackage?: number; joiningRate?: number;
  status?: Record<string, number>;
};
type Company = { id: string; name: string; industry?: string | null; relationshipStatus?: string };
type Drive = { id: string; title: string; status: string; driveDate: string | null; applicationDeadline?: string | null; campusId?: string | null; company: { id: string; name: string } };
type Application = {
  id: string; status: string; student?: { id: string; firstName: string; lastName: string };
  opportunity: { title: string; organization: string; deadline?: string | null };
};
type ScheduleItem = {
  id: string; kind: "Drive" | "Interview" | "Assessment" | "Company visit"; title: string;
  company: string; startsAt: string; status: string; venue: string; href: string;
};
type AutomationFailure = { id: string; name: string; attempts: number; lastError: string | null; createdAt: string };
type ApiList<T> = { data?: T[] };

async function listData<T>(path: string): Promise<T[]> {
  const response = await authedFetch<ApiList<T>>(path);
  return Array.isArray(response.data) ? response.data : [];
}


export default function PlacementTeamWorkspace() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [failures, setFailures] = useState<AutomationFailure[]>([]);
  const [failureAccessError, setFailureAccessError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [driveStatusFilter, setDriveStatusFilter] = useState("ALL");
  const [applicationStatusFilter, setApplicationStatusFilter] = useState("ALL");
  const [eventFilter, setEventFilter] = useState("UPCOMING");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [metricResponse, companyRows, driveRows, applicationRows] = await Promise.all([
        authedFetch<{ data: Metrics }>("/placements/metrics"),
        listData<Company>("/placements/companies"),
        listData<Drive>("/placements/drives?page=1&pageSize=100"),
        listData<Application>("/placements/applications"),
      ]);
      setMetrics(metricResponse.data || null);
      setCompanies(companyRows);
      setDrives(driveRows);
      setApplications(applicationRows);

      const [interviewResult, testResult, visitResult, failureResult] = await Promise.allSettled([
        listData<Record<string, unknown>>("/placements/interviews"),
        listData<Record<string, unknown>>("/placements/tests"),
        listData<Record<string, unknown>>("/placements/visits"),
        listData<AutomationFailure>("/placements/automation/failures"),
      ]);

      if (failureResult.status === "fulfilled") {
        setFailures(failureResult.value);
        setFailureAccessError("");
      } else {
        setFailures([]);
        setFailureAccessError(failureResult.reason instanceof HttpRequestError ? failureResult.reason.message : "Automation status is not available for this role.");
      }

      const mapEvent = (
        rows: Record<string, unknown>[],
        kind: ScheduleItem["kind"],
        href: string,
        startKeys: string[],
        titleFrom: (row: Record<string, unknown>) => string,
      ): ScheduleItem[] => rows.map((row) => {
        const drive = row.drive && typeof row.drive === "object" ? row.drive as Record<string, unknown> : {};
        const driveCompany = drive.company && typeof drive.company === "object" ? drive.company as Record<string, unknown> : {};
        const directCompany = row.company && typeof row.company === "object" ? row.company as Record<string, unknown> : {};
        const startsAt = startKeys.map((key) => row[key]).find((v) => typeof v === "string" && v.length) as string | undefined;
        return {
          id: String(row.id || ""),
          kind,
          title: titleFrom(row),
          company: String(driveCompany.name || directCompany.name || "Company not specified"),
          startsAt: startsAt || "",
          status: String(row.status || "UNKNOWN"),
          venue: String(row.venue || row.onlineLink || row.testLink || ""),
          href,
        };
      }).filter((event) => event.id && event.startsAt && Number.isFinite(new Date(event.startsAt).getTime()));

      const combined = [
        ...driveRows.map((drive): ScheduleItem => ({
          id: drive.id, kind: "Drive", title: drive.title, company: drive.company.name,
          startsAt: drive.driveDate || "", status: drive.status, venue: "",
          href: "/placements/drives",
        })).filter((event) => event.startsAt),
        ...(interviewResult.status === "fulfilled" ? mapEvent(interviewResult.value, "Interview", "/placements/interviews", ["startsAt"], (row) => {
          const drive = row.drive && typeof row.drive === "object" ? row.drive as Record<string, unknown> : {};
          return String(drive.title || row.roundType || "Placement interview") + (row.roundNumber ? " · Round " + String(row.roundNumber) : "");
        }) : []),
        ...(testResult.status === "fulfilled" ? mapEvent(testResult.value, "Assessment", "/placements/tests", ["scheduledAt", "startsAt"], (row) => String(row.title || "Placement assessment")) : []),
        ...(visitResult.status === "fulfilled" ? mapEvent(visitResult.value, "Company visit", "/placements/visits", ["startsAt"], (row) => String(row.type || row.title || "Placement activity")) : []),
      ];
      setSchedule(combined.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    } catch (cause) {
      if (cause instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(cause instanceof HttpRequestError ? cause.message : "Unable to load placement operations.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const query = search.trim().toLowerCase();
  const visibleDrives = useMemo(() => drives.filter((drive) => {
    const matchesSearch = !query || [drive.title, drive.company.name, drive.status].some((value) => value.toLowerCase().includes(query));
    return matchesSearch &&
      (companyFilter === "ALL" || drive.company.id === companyFilter) &&
      (driveStatusFilter === "ALL" || drive.status === driveStatusFilter);
  }), [drives, query, companyFilter, driveStatusFilter]);

  const visibleApplications = useMemo(() => applications.filter((application) => {
    const studentName = application.student ? application.student.firstName + " " + application.student.lastName : "";
    const matchesSearch = !query || [application.opportunity.title, application.opportunity.organization, application.status, studentName].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (applicationStatusFilter === "ALL" || application.status === applicationStatusFilter);
  }), [applications, query, applicationStatusFilter]);

  const visibleSchedule = useMemo(() => {
    const now = Date.now();
    return schedule.filter((event) => {
      const time = new Date(event.startsAt).getTime();
      const cancelled = ["CANCELLED", "CANCELED"].includes(event.status.toUpperCase());
      return eventFilter === "ALL" || (eventFilter === "UPCOMING" && !cancelled && time >= now) || (eventFilter === "PAST" && time < now);
    });
  }, [schedule, eventFilter]);

  async function transition(applicationId: string, status: string) {
    setBusy(applicationId + status);
    setError("");
    try {
      await authedFetch("/placements/applications/" + applicationId + "/status", {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to update this application.");
    } finally {
      setBusy(null);
    }
  }

  async function retryFailure(failure: AutomationFailure) {
    setBusy("retry:" + failure.id);
    setError("");
    try {
      await authedFetch("/placements/automation/failures/" + failure.id + "/retry", { method: "POST" });
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to retry placement automation.");
    } finally {
      setBusy(null);
    }
  }

  const now = Date.now();
  const upcomingSchedules = schedule.filter((item) => {
    const time = new Date(item.startsAt).getTime();
    return time >= now && time <= now + 14 * 24 * 60 * 60 * 1000 && !["CANCELLED", "CANCELED"].includes(item.status.toUpperCase());
  });
  const draftCount = drives.filter((drive) => drive.status === "DRAFT").length;
  const responsePending = applications.filter((app) => app.status === "OFFERED").length;
  const statusActions: Record<string, Array<{ status: string; label: string }>> = {
    APPLICATION_SUBMITTED: [{ status: "SHORTLISTED", label: "Shortlist" }, { status: "REJECTED", label: "Reject" }],
    SHORTLISTED: [{ status: "TEST", label: "Move to test" }, { status: "INTERVIEW", label: "Move to interview" }, { status: "REJECTED", label: "Reject" }],
    TEST: [{ status: "INTERVIEW", label: "Move to interview" }, { status: "SELECTED", label: "Select candidate" }, { status: "REJECTED", label: "Reject" }],
    INTERVIEW: [{ status: "SELECTED", label: "Select candidate" }, { status: "REJECTED", label: "Reject" }],
  };

  const cards: Array<[string, string, string]> = [
    ["Companies", String(metrics?.companies ?? companies.length), "Employer records in this scope"],
    ["Active drives", String(metrics?.openDrives ?? 0), "Published and in-progress recruitment"],
    ["Applications", String(metrics?.applications ?? applications.length), "Candidate applications"],
    ["Offers", String(metrics?.offers ?? 0), "Authoritative offer records"],
    ["Upcoming schedules", String(upcomingSchedules.length), "Next 14 days"],
    ["Unpublished drafts", String(draftCount), "Require publication or cleanup"],
    ["Awaiting candidate response", String(responsePending), "Applications offered / accepted"],
    ["Automation failures", String(failures.length), "Retryable placement events"],
  ];

  return (
    <PlacementTeamShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Career services · Operations</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Placement Command Center</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Manage recruitment across the connected drive, candidate, schedule, offer and communication workflows. Student-facing changes are processed from authoritative placement records and the database event outbox.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DataExportActions type={["placement-companies", "placement-drives", "placement-openings", "placement-applications", "placement-offers"]} compact />
              <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{loading ? "Refreshing…" : "Refresh workspace"}</button>
            </div>
          </div>
        </section>

        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, value, help]) => <article key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{loading ? "—" : value}</p>
            <p className="mt-1 text-xs text-slate-500">{help}</p>
          </article>)}
        </section>

        <section className="grid gap-4 rounded-2xl border bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">Search drives and candidates
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Company, drive, student, application status…" className="rounded-xl border px-3 py-3 font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Company
            <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Drive status
            <select value={driveStatusFilter} onChange={(event) => setDriveStatusFilter(event.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All statuses</option>{[...new Set(drives.map((drive) => drive.status))].sort().map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>
          </label>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black text-slate-950">Drive publication queue</h2><span className="text-xs text-slate-500">{visibleDrives.length} of {drives.length} loaded</span></div>
            <div className="mt-4 space-y-3">
              {visibleDrives.slice(0, 8).map((drive) => <div key={drive.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-slate-950">{drive.title}</p><p className="text-sm text-slate-600">{drive.company.name}</p><p className="mt-1 text-xs text-slate-500">{drive.driveDate ? new Date(drive.driveDate).toLocaleString("en-IN") : "No drive date set"}{drive.applicationDeadline ? " · Deadline " + new Date(drive.applicationDeadline).toLocaleString("en-IN") : ""}</p></div><span className={"rounded-full px-2 py-1 text-xs font-bold " + (drive.status === "DRAFT" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800")}>{drive.status.replaceAll("_", " ")}</span></div>
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => router.push("/placements/drives")} className="rounded-lg border px-3 py-2 text-xs font-bold">Open drive workspace</button>{drive.status === "DRAFT" && <button type="button" onClick={() => router.push("/placements/drives")} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800">Publish draft</button>}</div>
              </div>)}
              {!loading && !visibleDrives.length && <p className="py-6 text-center text-sm text-slate-500">No drives match these filters.</p>}
            </div>
            <button type="button" onClick={() => router.push("/placements/drives")} className="mt-4 rounded-xl border px-4 py-2 text-sm font-bold">Manage all drives</button>
          </article>

          <article className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black text-slate-950">Candidate pipeline</h2><span className="text-xs text-slate-500">{visibleApplications.length} of {applications.length} loaded</span></div>
            <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-slate-600">Application stage
              <select value={applicationStatusFilter} onChange={(event) => setApplicationStatusFilter(event.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal"><option value="ALL">All stages</option>{[...new Set(applications.map((application) => application.status))].sort().map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>
            </label>
            <div className="mt-4 space-y-3">
              {visibleApplications.slice(0, 8).map((application) => <div key={application.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-bold text-slate-950">{application.student ? application.student.firstName + " " + application.student.lastName : "Candidate"}</p><p className="text-sm text-slate-600">{application.opportunity.title} · {application.opportunity.organization}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{application.status.replaceAll("_", " ")}</span></div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(statusActions[application.status] || []).map((action) => <button type="button" key={action.status} disabled={busy === application.id + action.status} onClick={() => void transition(application.id, action.status)} className={"rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 " + (action.status === "REJECTED" ? "border-red-200 text-red-700" : "text-slate-800")}>{busy === application.id + action.status ? "Updating…" : action.label}</button>)}
                  {["SELECTED", "OFFERED", "ACCEPTED"].includes(application.status) && <button type="button" onClick={() => router.push("/placements/offers")} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800">Manage offer / joining</button>}
                </div>
              </div>)}
              {!loading && !visibleApplications.length && <p className="py-6 text-center text-sm text-slate-500">No applications match these filters.</p>}
            </div>
            <button type="button" onClick={() => router.push("/placements/applications")} className="mt-4 rounded-xl border px-4 py-2 text-sm font-bold">Open application pipeline</button>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black text-slate-950">Recruitment schedule</h2><span className="text-xs text-slate-500">{visibleSchedule.length} event(s)</span></div>
            <div className="mt-3 flex flex-wrap gap-2">{[["UPCOMING", "Upcoming"], ["PAST", "Past"], ["ALL", "All dates"]].map(([value, label]) => <button type="button" key={value} onClick={() => setEventFilter(value)} className={"rounded-lg border px-3 py-2 text-xs font-bold " + (eventFilter === value ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "text-slate-700")}>{label}</button>)}</div>
            <div className="mt-4 space-y-3">
              {visibleSchedule.slice(0, 8).map((event) => <div key={event.kind + event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0"><p className="font-bold text-slate-950">{event.title}</p><p className="text-sm text-slate-600">{event.company} · {event.kind}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.startsAt).toLocaleString("en-IN")} · {event.status}</p>{event.venue && <p className="mt-1 text-xs text-slate-500">{event.venue}</p>}</div>
                <button type="button" onClick={() => router.push(event.href)} className="rounded-lg border px-3 py-2 text-xs font-bold">Open</button>
              </div>)}
              {!loading && !visibleSchedule.length && <p className="py-6 text-center text-sm text-slate-500">No events match this date range.</p>}
            </div>
            <button type="button" onClick={() => router.push("/placements/calendar")} className="mt-4 rounded-xl border px-4 py-2 text-sm font-bold">Open placement calendar</button>
          </article>

          <article className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black text-slate-950">Automation failures</h2><span className="text-xs text-slate-500">{failures.length} pending</span></div>
            <p className="mt-2 text-sm text-slate-600">Only unprocessed placement events with recorded attempts are listed. Retry requeues the same outbox event; its stable notification keys prevent duplicate in-app notifications.</p>
            {failureAccessError && failures.length === 0 && <p className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">{failureAccessError}</p>}
            <div className="mt-4 space-y-3">
              {failures.map((failure) => <div key={failure.id} className="rounded-xl border border-amber-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-slate-950">{failure.name}</p><p className="mt-1 text-xs text-slate-500">Attempts: {failure.attempts} · {new Date(failure.createdAt).toLocaleString("en-IN")}</p></div><button type="button" disabled={busy === "retry:" + failure.id} onClick={() => void retryFailure(failure)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">{busy === "retry:" + failure.id ? "Queueing…" : "Retry event"}</button></div>
                {failure.lastError && <p className="mt-2 break-words text-xs text-red-700">{failure.lastError}</p>}
              </div>)}
              {!failures.length && !failureAccessError && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">No failed placement events are waiting for review.</p>}
            </div>
            <button type="button" onClick={() => router.push("/placements/reports")} className="mt-4 rounded-xl border px-4 py-2 text-sm font-bold">Placement reports</button>
          </article>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["/placements/companies", "Company & recruiter master", "Employers, contacts and relationship history"],
            ["/placements/openings", "Job openings", "Role, package and eligibility"],
            ["/placements/students", "Placement students", "Profiles, readiness and student scope"],
            ["/placements/visits", "Activities & training", "Pre-placement talks, orientation and visits"],
            ["/placements/tests", "Tests & assessments", "Candidate assignments, instructions and outcomes"],
            ["/placements/interviews", "Interviews", "Round scheduling, shortlist assignments and outcomes"],
            ["/placements/offers", "Offers & joining", "Offer decisions, response deadlines and joining verification"],
            ["/placements/reports", "Placement intelligence", "Hiring outcomes and institutional trends"],
          ].map(([href, title, description]) => <button key={href} type="button" onClick={() => router.push(href)} className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5"><h2 className="font-black text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></button>)}
        </section>
      </div>
    </PlacementTeamShell>
  );
}
