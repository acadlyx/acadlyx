"use client";

import { useEffect, useState } from "react";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import DataExportActions from "@/components/dashboard/DataExportActions";

type Metrics = Record<string, unknown>;

export default function PlacementReportsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void authedFetch<{ data: Metrics }>("/placements/metrics")
      .then((response) => setMetrics(response.data))
      .catch((cause) => {
        if (cause instanceof AuthRequiredError) {
          window.location.assign("/login");
          return;
        }
        setError(cause instanceof HttpRequestError ? cause.message : "Unable to load placement intelligence.");
      });
  }, []);

  const rows: Array<[string, unknown]> = [
    ["Companies", metrics?.companies],
    ["Drives", metrics?.drives],
    ["Applications", metrics?.applications],
    ["Offers", metrics?.offers],
    ["Accepted offers", metrics?.acceptedOffers],
    ["Joined", metrics?.joinedOffers],
    ["Placement rate", metrics ? `${String(metrics.placementRate)}%` : "—"],
    ["Offer acceptance", metrics ? `${String(metrics.offerAcceptanceRate)}%` : "—"],
    ["Joining rate", metrics ? `${String(metrics.joiningRate)}%` : "—"],
    ["Average package", metrics ? `INR ${Number(metrics.averagePackage || 0).toLocaleString("en-IN")}` : "—"],
    ["Highest package", metrics ? `INR ${Number(metrics.highestPackage || 0).toLocaleString("en-IN")}` : "—"],
  ];

  return (
    <DashboardShell title="Placement Intelligence" subtitle="Authoritative placement outcomes calculated from canonical drives, applications, offers and joining records." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-6xl space-y-6">
        {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map(([label, value]) => <article key={label} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value == null ? "—" : String(value)}</p></article>)}
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">Placement data exports</h2>
          <p className="text-sm text-slate-600">Export canonical placement datasets using server-side authorization and institution scope. The metrics above remain live summary values; the exporter provides the detailed records.</p>
          <DataExportActions type={["placement-companies", "placement-drives", "placement-openings", "placement-applications", "placement-offers", "placement-visits", "placement-tests", "placement-interviews"]} />
        </section>
      </div>
    </DashboardShell>
  );
}
