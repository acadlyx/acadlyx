"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";

import {
  AuthRequiredError,
  isAuthenticated,
} from "@/lib/auth";

import {
  getMyTimetable,
  StudentTimetableEntry,
} from "@/lib/studentApi";

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function StudentTimetablePage() {
  const router =
    useRouter();

  const [entries, setEntries] =
    useState<
      StudentTimetableEntry[]
    >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      if (!isAuthenticated()) {
        router.replace("/login");
        return;
      }

      setEntries(
        await getMyTimetable()
      );
    } catch (reason) {
      if (
        reason instanceof AuthRequiredError
      ) {
        router.replace("/login");
        return;
      }

      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load timetable."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const grouped =
    useMemo(() => {
      return days.map(
        (day, dayOfWeek) => ({
          day,
          classes:
            entries.filter(
              (entry) =>
                entry.dayOfWeek ===
                dayOfWeek
            ),
        })
      );
    }, [entries]);

  return (
    <DashboardShell
      title="Timetable"
      subtitle="Your enrolled classes, rooms and faculty"
      allowedRoles={[
        "STUDENT",
      ]}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
            Academics
          </p>

          <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                My week
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Your complete weekly class
                schedule in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Refresh
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-white p-5">
            <p className="font-bold text-red-700">
              Couldn&apos;t load timetable
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {error}
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({
              length: 3,
            }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="acadlyx-skeleton h-5 w-28 rounded" />
                <div className="acadlyx-skeleton mt-5 h-16 rounded-xl" />
                <div className="acadlyx-skeleton mt-3 h-16 rounded-xl" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-bold text-slate-900">
              No timetable published
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Your section does not have
              published timetable entries yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(
              ({ day, classes }) =>
                classes.length > 0 && (
                  <section
                    key={day}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <header className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                      <h2 className="font-bold text-slate-900">
                        {day}
                      </h2>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {classes.length}{" "}
                        class
                        {classes.length ===
                        1
                          ? ""
                          : "es"}
                      </p>
                    </header>

                    <div className="divide-y divide-slate-100">
                      {classes.map(
                        (entry) => (
                          <article
                            key={
                              entry.id
                            }
                            className="grid gap-3 p-5 sm:grid-cols-[140px_1fr_auto] sm:items-center"
                          >
                            <div>
                              <p className="text-sm font-bold text-blue-600">
                                {
                                  entry.startTime
                                }{" "}
                                –{" "}
                                {
                                  entry.endTime
                                }
                              </p>
                            </div>

                            <div>
                              <p className="font-bold text-slate-900">
                                {
                                  entry
                                    .course
                                    .name
                                }
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                {
                                  entry
                                    .course
                                    .code
                                }
                                {entry.faculty
                                  ? ` · ${entry.faculty}`
                                  : ""}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              {entry.room ||
                                "Room pending"}
                            </div>
                          </article>
                        )
                      )}
                    </div>
                  </section>
                )
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
