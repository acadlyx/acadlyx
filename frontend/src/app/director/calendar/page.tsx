"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DirectorCalendarPage() {
  return (
    <DashboardShell
      title="Campus calendar"
      subtitle="Campus-scoped event management for your assigned campuses."
    >
      <main className="acadlyx-page-container acadlyx-workspace-content">
        <header className="acadlyx-page-header">
          <div>
            <p className="acadlyx-eyebrow">DIRECTOR WORKSPACE</p>
            <h1 className="acadlyx-page-title">Campus calendar</h1>
            <p className="acadlyx-page-description">
              Calendar records currently belong to the institution rather than an assigned campus.
              This page will not show or change institution-wide calendar records from a Director workspace.
            </p>
          </div>
        </header>
        <section className="acadlyx-section-card p-6" aria-labelledby="campus-calendar-scope-title">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-amber-50 p-3 text-amber-800" aria-hidden="true">!</div>
            <div className="min-w-0">
              <h2 id="campus-calendar-scope-title" className="text-lg font-bold text-slate-900">
                Use campus-scoped Events &amp; Gallery
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                The calendar data model does not yet record campus ownership, so showing its records here
                could expose events from other campuses. Events &amp; Gallery enforces your assigned-campus
                scope and supports creating and managing events safely.
              </p>
              <Link
                href="/director/events-gallery"
                className="mt-5 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Open Events &amp; Gallery
              </Link>
            </div>
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
