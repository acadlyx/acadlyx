"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import {
  createAdmitCardTemplate,
  deleteAdmitCardTemplate,
  listAdmitCardTemplates,
  updateAdmitCardTemplate,
  type AdmitCardTemplate,
} from "@/lib/admitCardTemplatesApi";
import { useRouter } from "next/navigation";

export default function AdmitCardTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<AdmitCardTemplate[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setTemplates(await listAdmitCardTemplates());
    } catch (reason) {
      if (reason instanceof AuthRequiredError) router.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Unable to load templates.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await createAdmitCardTemplate({
        name,
        description,
        config: {
          paperSize: "A4",
          orientation: "portrait",
          showPhoto: true,
          showQr: true,
          showInstitutionAddress: true,
          showEnrollmentNumber: true,
          showProgram: true,
          showDepartment: true,
          showSemester: true,
          showInstructions: true,
          showSignatures: true,
        },
      });
      setName("");
      setDescription("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create template.");
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: string) {
    try {
      await updateAdmitCardTemplate(id, { status: "ACTIVE" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to activate template.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this admit-card template?")) return;
    try {
      await deleteAdmitCardTemplate(id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete template.");
    }
  }

  return (
    <DashboardShell title="Admit Card Templates" subtitle="Reusable institution-scoped examination document designs">
      <main className="mx-auto max-w-6xl space-y-6 pb-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Examination configuration</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Reusable admit-card templates</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Templates are tenant-scoped and stored as structured configuration so document layouts can evolve without duplicating examination data.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" />
            <button onClick={() => void create()} disabled={busy || !name.trim()} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">
              {busy ? "Saving…" : "Create template"}
            </button>
          </div>
        </section>

        {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-black text-slate-950">{template.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{template.description || "A reusable A4 admit-card configuration."}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-600">{template.status}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-slate-600">
                {Object.entries(template.config).slice(0, 8).map(([key, value]) => (
                  <div key={key} className="rounded-xl bg-slate-50 p-3">
                    <span className="font-bold">{key}</span>: {String(value)}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                {template.status !== "ACTIVE" ? <button onClick={() => void activate(template.id)} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Activate</button> : null}
                <button onClick={() => void remove(template.id)} className="rounded-xl border border-red-200 px-4 py-2 text-xs font-black text-red-700">Delete</button>
              </div>
            </article>
          ))}
          {templates.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 md:col-span-2">No templates yet. Create the institution's first reusable admit-card design.</div> : null}
        </section>
      </main>
    </DashboardShell>
  );
}
