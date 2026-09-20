"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import EntityPicker from "@/components/common/EntityPicker";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { DirectoryOption } from "@/lib/directoryApi";
import {
  Asset,
  Facility,
  MaintenanceRequest,
  OperationsSummary,
  createAsset,
  createFacility,
  createMaintenance,
  getOperationsSummary,
  listAssets,
  listFacilities,
  listMaintenance,
  updateAsset,
  updateMaintenance,
} from "@/lib/operationsApi";

/**
 * Campus operations: the asset register, the facility register and the
 * maintenance queue. Anyone in the institution can raise a fault;
 * triage and the registers themselves need operations rights.
 */

type Tab = "maintenance" | "assets" | "facilities";

export default function OperationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("maintenance");
  const [roles, setRoles] = useState<string[]>([]);
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = roles.some((role) =>
    ["SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT", "STAFF"].includes(
      role
    )
  );

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await fn();
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const loadMaintenance = useCallback(async () => {
    const result = await listMaintenance({
      page: 1,
      status: statusFilter || undefined,
    });
    setRequests(result.items);
  }, [statusFilter]);

  useEffect(() => {
    void run(async () => {
      const user = await getCurrentUser();
      setRoles(user?.roles ?? []);
      const [ops] = await Promise.all([
        getOperationsSummary().catch(() => null),
        loadMaintenance(),
      ]);
      if (ops) setSummary(ops);
    });
  }, [run, loadMaintenance]);

  useEffect(() => {
    if (tab === "assets") {
      void run(async () => {
        setAssets((await listAssets({ page: 1 })).items);
      });
    }
    if (tab === "facilities") {
      void run(async () => {
        setFacilities(await listFacilities({}));
      });
    }
  }, [tab, run]);

  return (
    <DashboardShell
      title="Operations"
      subtitle="Assets, facilities and the campus maintenance queue"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {summary && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Assets", summary.assets.total],
              ["Under repair", summary.assets.underRepair],
              ["Active facilities", summary.facilities.active],
              ["Open requests", summary.maintenance.open],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {Number(value).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </section>
        )}

        <div className="flex gap-2">
          {(["maintenance", "assets", "facilities"] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${
                tab === key
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        {tab === "maintenance" && (
          <>
            <RaiseRequestForm
              facilities={facilities}
              busy={busy}
              onLoadFacilities={() =>
                run(async () => setFacilities(await listFacilities({})))
              }
              onSubmit={(body) =>
                run(async () => {
                  await createMaintenance(body);
                  await loadMaintenance();
                  setNotice("Maintenance request raised");
                })
              }
            />

            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">
                  Maintenance queue
                </h2>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  {[
                    "OPEN",
                    "ASSIGNED",
                    "IN_PROGRESS",
                    "RESOLVED",
                    "CLOSED",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {requests.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing in the queue.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {requests.map((request) => (
                    <li
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {request.title}
                          <span
                            className={`ml-2 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                              request.priority === "URGENT"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {request.priority}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {request.facilityName ?? request.assetName ?? "—"} ·
                          raised by {request.raisedByName} ·{" "}
                          {request.assignedToName
                            ? `assigned to ${request.assignedToName}`
                            : "unassigned"}{" "}
                          · {request.status}
                        </p>
                      </div>
                      {canManage && request.status !== "CLOSED" && (
                        <select
                          value=""
                          disabled={busy}
                          onChange={(event) =>
                            event.target.value &&
                            run(async () => {
                              await updateMaintenance(request.id, {
                                status: event.target.value,
                              });
                              await loadMaintenance();
                            })
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="">Move to…</option>
                          {[
                            "ASSIGNED",
                            "IN_PROGRESS",
                            "RESOLVED",
                            "CLOSED",
                            "REJECTED",
                          ].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {tab === "assets" && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Asset register</h2>
            {canManage && (
              <AssetForm
                busy={busy}
                onSubmit={(body) =>
                  run(async () => {
                    await createAsset(body);
                    setAssets((await listAssets({ page: 1 })).items);
                    setNotice("Asset added");
                  })
                }
              />
            )}
            {assets.length === 0 ? (
              <p className="text-sm text-slate-500">No assets recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-2">Tag</th>
                      <th className="pb-2">Asset</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2">Holder</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="py-2 font-mono text-xs text-slate-500">
                          {asset.assetTag}
                        </td>
                        <td className="py-2 font-medium text-slate-900">
                          {asset.name}
                        </td>
                        <td className="py-2 text-slate-600">
                          {asset.categoryName ?? "—"}
                        </td>
                        <td className="py-2 text-slate-600">
                          {asset.location ?? "—"}
                        </td>
                        <td className="py-2 text-slate-600">
                          {asset.assignedToName ?? "—"}
                        </td>
                        <td className="py-2">
                          {canManage ? (
                            <select
                              value={asset.status}
                              disabled={busy}
                              onChange={(event) =>
                                run(async () => {
                                  await updateAsset(asset.id, {
                                    status: event.target.value,
                                  });
                                  setAssets(
                                    (await listAssets({ page: 1 })).items
                                  );
                                })
                              }
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            >
                              {[
                                "IN_USE",
                                "IN_STORE",
                                "UNDER_REPAIR",
                                "RETIRED",
                                "LOST",
                              ].map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs">{asset.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "facilities" && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Facilities</h2>
            {canManage && (
              <FacilityForm
                busy={busy}
                onSubmit={(body) =>
                  run(async () => {
                    await createFacility(body);
                    setFacilities(await listFacilities({}));
                    setNotice("Facility added");
                  })
                }
              />
            )}
            {facilities.length === 0 ? (
              <p className="text-sm text-slate-500">No facilities recorded.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {facilities.map((facility) => (
                  <li
                    key={facility.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <p className="font-semibold text-slate-900">
                      {facility.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {facility.code} · {facility.facilityType}
                      {facility.capacity ? ` · seats ${facility.capacity}` : ""}
                    </p>
                    {facility.openRequests > 0 && (
                      <p className="mt-2 text-xs font-semibold text-amber-700">
                        {facility.openRequests} open maintenance request(s)
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function RaiseRequestForm({
  facilities,
  busy,
  onLoadFacilities,
  onSubmit,
}: {
  facilities: Facility[];
  busy: boolean;
  onLoadFacilities: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    facilityId: "",
    title: "",
    description: "",
    priority: "MEDIUM",
  });

  useEffect(() => {
    if (facilities.length === 0) onLoadFacilities();
    // Facilities are only needed to populate this picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.facilityId) return;
        onSubmit(form);
        setForm({ ...form, title: "", description: "" });
      }}
      className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-4"
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Facility</span>
        <select
          required
          value={form.facilityId}
          onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        >
          <option value="">Select…</option>
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Problem</span>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Projector not powering on"
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Details</span>
        <input
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Priority</span>
        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        >
          {["LOW", "MEDIUM", "HIGH", "URGENT"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 sm:w-48"
      >
        Raise request
      </button>
    </form>
  );
}

function AssetForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [holder, setHolder] = useState<DirectoryOption | null>(null);
  const [form, setForm] = useState({
    name: "",
    assetTag: "",
    location: "",
    quantity: "1",
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...form,
          quantity: Number(form.quantity),
          assignedToId: holder?.id,
        });
        setForm({ name: "", assetTag: "", location: "", quantity: "1" });
        setHolder(null);
      }}
      className="grid gap-3 rounded-2xl bg-slate-50 p-5 sm:grid-cols-5"
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Name</span>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Tag</span>
        <input
          required
          value={form.assetTag}
          onChange={(e) => setForm({ ...form, assetTag: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Location</span>
        <input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <div>
        <EntityPicker
          kind="user"
          label="Assign to (optional)"
          value={holder}
          onChange={setHolder}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="h-10 self-end rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
      >
        Add asset
      </button>
    </form>
  );
}

function FacilityForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    facilityType: "CLASSROOM",
    capacity: "",
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...form,
          capacity: form.capacity ? Number(form.capacity) : undefined,
        });
        setForm({ ...form, name: "", code: "", capacity: "" });
      }}
      className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-5"
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Name</span>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-48 rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Code</span>
        <input
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          className="w-32 rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Type</span>
        <select
          value={form.facilityType}
          onChange={(e) => setForm({ ...form, facilityType: e.target.value })}
          className="rounded-xl border border-slate-200 px-3 py-2"
        >
          {[
            "CLASSROOM",
            "LAB",
            "AUDITORIUM",
            "LIBRARY",
            "HOSTEL",
            "SPORTS",
            "OTHER",
          ].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-600">Capacity</span>
        <input
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          className="w-28 rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
      >
        Add facility
      </button>
    </form>
  );
}
