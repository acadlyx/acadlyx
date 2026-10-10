"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type Drive = { id: string; title: string; status: string; applicationDeadline: string | null; company: { id: string; name: string; logoUrl: string | null } };
type Application = { id: string; status: string; appliedAt: string; opportunity: { title: string; organization: string; deadline: string | null } };
type Offer = { id: string; status: string; role: string; totalCtc: number | null; currency: string; joiningDate: string | null; company: { name: string } };
type Test = { id: string; title: string; mode: string; scheduledAt: string; drive: { title: string; company: { name: string } }; participants: Array<{ attendanceStatus: string; resultStatus: string; score: number | null }> };
type Profile = { profile: { placementStatus: string; bio: string | null; portfolioUrl: string | null; githubUrl: string | null; linkedInUrl: string | null } | null; skills: unknown[]; certifications: unknown[]; projects: unknown[]; resumes: unknown[] };

export default function StudentPlacementsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [p, d, a, o, testsResponse] = await Promise.all([
        authedFetch<{ data: Profile }>("/placements/profile"),
        authedFetch<{ data: Drive[] }>("/placements/drives"),
        authedFetch<{ data: Application[] }>("/placements/applications"),
        authedFetch<{ data: Offer[] }>("/placements/offers"),
        authedFetch<{ data: Test[] }>("/placements/tests"),
      ]);
      setProfile(p.data);
      setDrives(d.data || []);
      setApplications(a.data || []);
      setOffers(o.data || []);
      setTests(testsResponse.data || []);
    } catch (e) {
      if (e instanceof AuthRequiredError) {
        router.replace("/login");
      } else {
        setError(e instanceof HttpRequestError ? e.message : "Unable to load your placement workspace.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function apply(id: string) {
    setBusy(id);
    setError("");
    try {
      await authedFetch("/placements/drives/" + id + "/apply", { method: "POST" });
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to apply to this drive.");
    } finally {
      setBusy(null);
    }
  }

  async function updateOffer(id: string, status: "ACCEPTED" | "REJECTED") {
    setBusy(id + status);
    setError("");
    try {
      await authedFetch("/placements/offers/" + id + "/respond", { method: "POST", body: JSON.stringify({ status }) });
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to update offer.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardShell title="My Placement" subtitle="Your placement profile, eligible drives, applications, interviews and offers." allowedRoles={["STUDENT"]}>
      <div className="mx-auto max-w-7xl space-y-6">
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Placement status", profile?.profile?.placementStatus || "SEEKING"],
            ["Skills", profile?.skills.length ?? 0],
            ["Projects", profile?.projects.length ?? 0],
            ["Current resumes", profile?.resumes.length ?? 0],
          ].map(([label, value]) => (
            <article key={String(label)} className="rounded-2xl border bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{loading ? "—" : String(value)}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Career profile</p><h2 className="mt-1 text-2xl font-black text-slate-950">Be application-ready</h2></div>
            <button onClick={() => void load()} disabled={loading} className="rounded-xl border px-4 py-2 text-sm font-bold">Refresh</button>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Maintain skills, certifications, projects, resume and approved professional links. Academic enrollment and eligibility remain authoritative institutional records.</p><a href="/student/placements/profile" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">Manage my placement profile</a>
          <div className="mt-5 flex flex-wrap gap-2">{[["Skills", profile?.skills.length], ["Certifications", profile?.certifications.length], ["Projects", profile?.projects.length], ["Resumes", profile?.resumes.length]].map(([a, b]) => <span key={String(a)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{a}: {String(b ?? 0)}</span>)}</div>
        </section>

        <section className="rounded-3xl border bg-white p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-950">Eligible placement drives</h2><span className="text-xs font-bold text-slate-500">{drives.length} visible</span></div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {drives.map((drive) => (
              <article key={drive.id} className="rounded-2xl border p-5">
                <div className="flex justify-between gap-4"><div><p className="text-lg font-black text-slate-950">{drive.title}</p><p className="text-sm font-semibold text-slate-600">{drive.company.name}</p></div><span className="h-fit rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">{drive.status}</span></div>
                {drive.applicationDeadline && <p className="mt-3 text-xs text-slate-500">Apply by {new Date(drive.applicationDeadline).toLocaleString("en-IN")}</p>}
                <button onClick={() => void apply(drive.id)} disabled={busy === drive.id || drive.status !== "APPLICATION_OPEN"} className="mt-4 min-h-11 w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{busy === drive.id ? "Applying…" : drive.status === "APPLICATION_OPEN" ? "Apply to drive" : "Applications unavailable"}</button>
              </article>
            ))}
            {!loading && drives.length === 0 && <p className="py-8 text-center text-sm text-slate-500 lg:col-span-2">No published placement drives are currently available.</p>}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black text-slate-950">My placement tests</h2><span className="text-xs font-bold text-slate-500">{tests.length} scheduled</span></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {tests.map((test) => <article key={test.id} className="rounded-2xl border p-4">
              <p className="font-black text-slate-950">{test.title}</p>
              <p className="mt-1 text-sm text-slate-600">{test.drive.company.name} · {test.drive.title}</p>
              <p className="mt-2 text-xs text-slate-500">{new Date(test.scheduledAt).toLocaleString("en-IN")} · {test.mode}</p>
              {test.participants[0] && <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{test.participants[0].resultStatus}</span>}
            </article>)}
            {!loading && tests.length === 0 && <p className="py-6 text-center text-sm text-slate-500 md:col-span-2">No placement tests are scheduled for you.</p>}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6">
          <h2 className="text-xl font-black text-slate-950">My applications</h2>
          <div className="mt-4 space-y-3">
            {applications.map((application) => <div key={application.id} className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-950">{application.opportunity.title}</p><p className="text-sm text-slate-600">{application.opportunity.organization}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{application.status}</span></div>)}
            {!loading && applications.length === 0 && <p className="py-8 text-center text-sm text-slate-500">You have not submitted a placement application yet.</p>}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6">
          <h2 className="text-xl font-black text-slate-950">My offers</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {offers.map((offer) => (
              <article key={offer.id} className="rounded-2xl border p-4">
                <div className="flex justify-between gap-3"><div><p className="font-black">{offer.company.name}</p><p className="text-sm text-slate-600">{offer.role}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{offer.status}</span></div>
                <p className="mt-3 text-sm font-bold">{offer.totalCtc == null ? "Package not disclosed" : offer.currency + " " + Number(offer.totalCtc).toLocaleString("en-IN")}</p>
                {offer.joiningDate && <p className="mt-1 text-xs text-slate-500">Joining: {new Date(offer.joiningDate).toLocaleDateString("en-IN")}</p>}
                {offer.status === "OFFERED" && <div className="mt-3 flex gap-2"><button disabled={busy === offer.id + "ACCEPTED"} onClick={() => void updateOffer(offer.id, "ACCEPTED")} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Accept</button><button disabled={busy === offer.id + "REJECTED"} onClick={() => void updateOffer(offer.id, "REJECTED")} className="rounded-xl border px-3 py-2 text-xs font-black">Reject</button></div>}
              </article>
            ))}
            {!loading && offers.length === 0 && <p className="py-8 text-center text-sm text-slate-500 md:col-span-2">No placement offers yet.</p>}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
