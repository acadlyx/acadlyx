"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";

type ProfileData = {
  profile: { placementStatus?: string | null; bio?: string | null; portfolioUrl?: string | null; githubUrl?: string | null; linkedInUrl?: string | null } | null;
  enrollment: { program?: { name?: string; department?: { name?: string } | null } | null; batch?: { name?: string } | null; semester?: { name?: string } | null; academicYear?: { name?: string } | null; section?: { name?: string } | null; status?: string } | null;
  skills: Array<{ skill?: { name?: string; category?: string | null } | null; proficiency?: number; evidence?: string | null }>;
  certifications: Array<{ id: string; name: string; issuer?: string | null; credentialUrl?: string | null }>;
  projects: Array<{ id: string; title: string; description?: string | null; projectUrl?: string | null; technologies?: unknown }>;
  resumes: Array<{ id: string; fileName?: string | null; url: string; isCurrent: boolean }>;
};
type Application = { id: string; status: string; appliedAt: string; opportunity?: { title: string; organization: string } | null; placementDrive?: { title: string; company?: { name: string } | null } | null };

export default function PlacementStudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const studentId = encodeURIComponent(params.id);
      const [profileResponse, applicationResponse] = await Promise.all([
        authedFetch<{ data: ProfileData }>(`/placements/profile?studentId=${studentId}`),
        authedFetch<{ data: Application[] }>(`/placements/applications?studentId=${studentId}`),
      ]);
      setProfile(profileResponse.data);
      setApplications(applicationResponse.data ?? []);
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof HttpRequestError ? reason.message : "Unable to load this placement profile in your authorized scope.");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => { void load(); }, [load]);

  return (
    <DashboardShell title="Student Placement Profile" subtitle="Professional profile and recruitment participation available within your authorized scope." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.push("/placements/students")} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Back to students</button>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Refresh profile</button>
        </div>
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading && <div role="status" className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Loading authorized placement profile…</div>}
        {!loading && profile && <>
          <section className="rounded-3xl border bg-white p-6">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Academic enrollment</p>
            <h2 className="mt-2 text-2xl font-black">{profile.enrollment?.program?.name ?? "Program not available"}</h2>
            <p className="mt-2 text-sm text-slate-600">{[profile.enrollment?.program?.department?.name, profile.enrollment?.batch?.name, profile.enrollment?.academicYear?.name, profile.enrollment?.semester?.name, profile.enrollment?.section?.name].filter(Boolean).join(" · ") || "Academic details are incomplete in the source enrollment record."}</p>
            <p className="mt-3 text-sm"><span className="font-semibold">Enrollment:</span> {profile.enrollment?.status ?? "Not available"} <span className="mx-2">·</span><span className="font-semibold">Placement status:</span> {profile.profile?.placementStatus ?? "Not set"}</p>
            {profile.profile?.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{profile.profile.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {profile.profile?.portfolioUrl && <a className="font-semibold text-emerald-700 underline" href={profile.profile.portfolioUrl} target="_blank" rel="noreferrer">Portfolio</a>}
              {profile.profile?.githubUrl && <a className="font-semibold text-emerald-700 underline" href={profile.profile.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
              {profile.profile?.linkedInUrl && <a className="font-semibold text-emerald-700 underline" href={profile.profile.linkedInUrl} target="_blank" rel="noreferrer">LinkedIn</a>}
            </div>
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border bg-white p-6"><h2 className="text-lg font-black">Skills</h2>{profile.skills.length ? <ul className="mt-4 space-y-3">{profile.skills.map((item,i)=><li key={item.skill?.name ?? i} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><span className="font-semibold">{item.skill?.name ?? "Unnamed skill"}</span><span className="text-sm text-slate-500">{item.proficiency ?? "—"}%</span></div>{item.evidence && <p className="mt-1 text-sm text-slate-600">{item.evidence}</p>}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No skills have been added.</p>}</section>
            <section className="rounded-3xl border bg-white p-6"><h2 className="text-lg font-black">Certifications</h2>{profile.certifications.length ? <ul className="mt-4 space-y-3">{profile.certifications.map(item=><li key={item.id} className="rounded-xl border p-3"><p className="font-semibold">{item.name}</p><p className="text-sm text-slate-500">{item.issuer || "Issuer not provided"}</p>{item.credentialUrl && <a className="text-sm text-emerald-700 underline" href={item.credentialUrl} target="_blank" rel="noreferrer">View credential</a>}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No certifications have been added.</p>}</section>
            <section className="rounded-3xl border bg-white p-6"><h2 className="text-lg font-black">Projects</h2>{profile.projects.length ? <ul className="mt-4 space-y-3">{profile.projects.map(item=><li key={item.id} className="rounded-xl border p-3"><p className="font-semibold">{item.title}</p>{item.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.description}</p>}{item.projectUrl && <a className="text-sm text-emerald-700 underline" href={item.projectUrl} target="_blank" rel="noreferrer">View project</a>}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No projects have been added.</p>}</section>
            <section className="rounded-3xl border bg-white p-6"><h2 className="text-lg font-black">Resumes</h2>{profile.resumes.length ? <ul className="mt-4 space-y-3">{profile.resumes.map(item=><li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-semibold">{item.fileName || "Resume"}</p>{item.isCurrent && <span className="text-xs font-bold text-emerald-700">Current resume</span>}</div><a className="text-sm font-semibold text-emerald-700 underline" href={item.url} target="_blank" rel="noreferrer">Open</a></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No resumes have been added.</p>}</section>
          </div>
          <section className="rounded-3xl border bg-white p-6"><h2 className="text-lg font-black">Applications and drive participation</h2>{applications.length ? <div className="mt-4 space-y-3">{applications.map(item=><article key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{item.placementDrive?.title ?? item.opportunity?.title ?? "Recruitment activity"}</p><p className="text-sm text-slate-600">{item.placementDrive?.company?.name ?? item.opportunity?.organization ?? "Company not available"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{item.status}</span></div><p className="mt-2 text-xs text-slate-500">Applied {new Date(item.appliedAt).toLocaleString()}</p></article>)}</div> : <p className="mt-3 text-sm text-slate-500">No placement applications are recorded for this student.</p>}</section>
        </>}
      </div>
    </DashboardShell>
  );
}
