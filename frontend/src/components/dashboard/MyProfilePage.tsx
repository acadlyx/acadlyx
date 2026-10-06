"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthRequiredError, authedFetch, getCurrentUser, type AuthUser } from "@/lib/auth";

type Account = {
  phone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  institution: { name: string; logoUrl: string | null } | null;
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  INSTITUTION_ADMIN: "Institution Admin",
  CHAIRMAN: "Chairman",
  MANAGEMENT: "Management",
  DIRECTOR: "Director",
  REGISTRAR: "Registrar",
  DEAN: "Dean",
  HOD: "Head of Department",
  FACULTY: "Faculty",
  ACCOUNTS: "Accounts",
  HR: "Human Resources",
  ADMISSIONS: "Admissions",
  EXAMINATION: "Examination Cell",
  LIBRARIAN: "Librarian",
  PLACEMENT: "Placement",
  IT: "IT",
  CMS_MANAGER: "CMS Manager",
  STUDENT: "Student",
  PARENT: "Parent",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || "Not provided"}</p>
    </div>
  );
}

function initials(user: AuthUser) {
  return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U";
}

export default function MyProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [current, accountResponse, photoResponse] = await Promise.all([
        getCurrentUser({ background: true }),
        authedFetch<{ success: boolean; data: Account }>("/auth/account"),
        authedFetch<{ success: boolean; data: { url: string | null } }>("/auth/account/photo"),
      ]);
      setUser(current);
      setAccount(accountResponse.data);
      setPhotoUrl(photoResponse.data.url);
      setFirstName(current.firstName);
      setLastName(current.lastName);
      setPhone(accountResponse.data.phone ?? "");
    } catch (err) {
      setError(err instanceof AuthRequiredError ? "Your session has expired." : err instanceof Error ? err.message : "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const roleNames = useMemo(
    () => (user?.roles ?? []).map((role) => ROLE_LABELS[role] ?? role.replace(/_/g, " ")),
    [user],
  );

  async function saveProfile() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await authedFetch<{ success: boolean; data: { firstName: string; lastName: string; phone: string | null } }>(
        "/auth/account",
        {
          method: "PATCH",
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim() || null,
          }),
        },
      );
      setUser((current) => current ? { ...current, firstName: response.data.firstName, lastName: response.data.lastName } : current);
      setAccount((current) => current ? { ...current, phone: response.data.phone } : current);
      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function updatePhoto(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Profile photo must be JPEG, PNG, WebP, or GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photo must be 5 MB or smaller.");
      return;
    }
    setPhotoBusy(true);
    setError("");
    setMessage("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read image"));
        reader.onerror = () => reject(new Error("Unable to read image"));
        reader.readAsDataURL(file);
      });
      const response = await authedFetch<{ success: boolean; data: { url: string } }>("/auth/account/photo", {
        method: "POST",
        body: JSON.stringify({ dataUrl }),
      });
      setPhotoUrl(response.data.url);
      setMessage("Profile photo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setError("");
    setMessage("");
    try {
      await authedFetch("/auth/account/photo", { method: "DELETE" });
      setPhotoUrl(null);
      setMessage("Profile photo removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove profile photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading your profile…</div>;
  if (!user) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || "Profile unavailable."}</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className="h-20 w-20 rounded-2xl object-cover shadow-sm" />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-slate-900 text-2xl font-black text-white">{initials(user)}</div>
            )}
            <label className="absolute -bottom-2 -right-2 cursor-pointer rounded-lg bg-white px-2 py-1 text-[10px] font-black shadow ring-1 ring-slate-200">
              {photoBusy ? "…" : "Photo"}
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={photoBusy} onChange={(e) => void updatePhoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">My profile</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{user.firstName} {user.lastName}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">{user.idNumber} · {user.email}</p>
          </div>
          <div className="sm:ml-auto flex flex-wrap gap-2">
            {photoUrl && <button type="button" disabled={photoBusy} onClick={() => void removePhoto()} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Remove photo</button>}
            <button type="button" onClick={() => { setEditing((value) => !value); setError(""); }} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">{editing ? "Cancel" : "Edit profile"}</button>
          </div>
        </div>

        {editing && (
          <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <label className="text-sm font-bold text-slate-700">First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-950" maxLength={100} /></label>
            <label className="text-sm font-bold text-slate-700">Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-950" maxLength={100} /></label>
            <label className="text-sm font-bold text-slate-700">Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-950" maxLength={30} /></label>
            <div className="sm:col-span-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void saveProfile()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button></div>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Identity">
          <div className="grid gap-3 sm:grid-cols-2">
            <Item label="First name" value={user.firstName} />
            <Item label="Last name" value={user.lastName} />
            <Item label="ID / login number" value={user.idNumber} />
            <Item label="Email" value={user.email} />
            <Item label="Phone" value={account?.phone} />
          </div>
        </Card>

        <Card title="Institution context">
          <div className="grid gap-3 sm:grid-cols-2">
            <Item label="Institution" value={account?.institution?.name ?? (user.institutionId ? "Institution account" : "Platform")} />
            <Item label="Account status" value="Active authenticated account" />
            <Item label="Member since" value={account?.createdAt ? new Date(account.createdAt).toLocaleDateString("en-IN") : null} />
            <Item label="Last sign-in" value={account?.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString("en-IN") : "Not recorded"} />
          </div>
        </Card>

        <Card title="Authority & access">
          <div className="space-y-3">
            <Item label="Roles" value={roleNames.length ? roleNames.join(" · ") : "No role assigned"} />
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Permissions</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.permissions.length ? user.permissions.map((permission) => (
                  <span key={permission} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{permission}</span>
                )) : <span className="text-sm font-semibold text-slate-500">No permissions returned</span>}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Security">
          <div className="grid gap-3 sm:grid-cols-2">
            <Item label="Authentication" value="ACADLYX authentication" />
            <Item label="Password" value="Managed in Account Security" />
            <Item label="Profile photo" value={photoUrl ? "Uploaded" : "Not uploaded"} />
            <Item label="Security controls" value="Account Security workspace" />
          </div>
        </Card>
      </div>
    </div>
  );
}
