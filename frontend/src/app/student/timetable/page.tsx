"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";

import {
  AuthRequiredError,
  isAuthenticated,
} from "@/lib/auth";

import {
  getMyTimetable,
  StudentTimetableEntry,
} from "@/lib/studentApi";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function time(
  value: string,
) {
  return value.slice(0, 5);
}

export default function StudentTimetablePage() {
  const router =
    useRouter();

  const [
    entries,
    setEntries,
  ] = useState<
    StudentTimetableEntry[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      if (
        !isAuthenticated()
      ) {
        router.replace(
          "/login",
        );

        return;
      }

      const timetable =
        await getMyTimetable();

      setEntries(
        timetable,
      );
    } catch (
      reason
    ) {
      if (
        reason instanceof
        AuthRequiredError
      ) {
        router.replace(
          "/login",
        );

        return;
      }

      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to load timetable.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /*
   * Generate rows from the actual
   * timetable entries.
   *
   * There is no institution-wide
   * hard-coded period system.
   */
  const timeRows =
    useMemo(() => {
      const starts =
        new Set<string>();

      for (
        const entry of entries
      ) {
        starts.add(
          time(
            entry.startTime,
          ),
        );
      }

      return [
        ...starts,
      ].sort();
    }, [entries]);

  function cellEntries(
    day: number,
    start: string,
  ) {
    return entries.filter(
      (entry) =>
        entry.dayOfWeek ===
          day &&
        time(
          entry.startTime,
        ) === start,
    );
  }

  return (
    <DashboardShell
      title="Timetable"
      subtitle="Your weekly classes, rooms and faculty"
      allowedRoles={[
        "STUDENT",
      ]}
    >
      <div className="space-y-5 pb-10">
        <section className="rounded-[24px] border border-[#dfe7ee] bg-white p-5 shadow-[0_8px_28px_rgba(20,32,50,0.04)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2864e8]">
                Academics
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#172033]">
                My weekly timetable
              </h1>

              <p className="mt-2 text-sm leading-6 text-[#718298]">
                Your schedule is generated
                from the classes assigned
                to your current enrollment
                and section.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void load()
              }
              className="rounded-xl border border-[#d9e2ea] bg-white px-4 py-2.5 text-sm font-extrabold text-[#334155] hover:bg-[#f7f9fb]"
            >
              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[24px] border border-[#dfe7ee] bg-white shadow-[0_8px_28px_rgba(20,32,50,0.04)]">
          {loading ? (
            <div className="space-y-3 p-5">
              {[
                1,
                2,
                3,
                4,
              ].map(
                (item) => (
                  <div
                    key={item}
                    className="acadlyx-skeleton h-20 rounded-xl"
                  />
                ),
              )}
            </div>
          ) : timeRows.length ===
            0 ? (
            <div className="p-12 text-center">
              <p className="font-black text-[#172033]">
                No timetable published
              </p>

              <p className="mt-1 text-sm text-[#718298]">
                Your section does not
                have scheduled classes
                yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1120px]">
                {/* HEADER */}
                <div className="grid grid-cols-[92px_repeat(7,minmax(145px,1fr))] border-b border-[#e8edf2] bg-[#f7f9fb]">
                  <div className="border-r border-[#e8edf2] px-3 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-[#8a99ab]">
                    Time
                  </div>

                  {DAYS.map(
                    (day) => (
                      <div
                        key={day}
                        className="border-r border-[#e8edf2] px-3 py-3 text-center text-xs font-black text-[#334155]"
                      >
                        {day}
                      </div>
                    ),
                  )}
                </div>

                {/* DYNAMIC TIME ROWS */}
                {timeRows.map(
                  (start) => (
                    <div
                      key={start}
                      className="grid grid-cols-[92px_repeat(7,minmax(145px,1fr))] border-b border-[#edf1f5] last:border-b-0"
                    >
                      <div className="border-r border-[#edf1f5] bg-[#fbfcfd] px-3 py-4 text-xs font-black text-[#52647a]">
                        {start}
                      </div>

                      {DAYS.map(
                        (
                          _,
                          day,
                        ) => {
                          const classes =
                            cellEntries(
                              day,
                              start,
                            );

                          return (
                            <div
                              key={`${start}-${day}`}
                              className="min-h-[112px] border-r border-[#edf1f5] p-1.5 last:border-r-0"
                            >
                              <div className="space-y-1.5">
                                {classes.map(
                                  (
                                    entry,
                                  ) => (
                                    <article
                                      key={
                                        entry.id
                                      }
                                      className="rounded-xl border border-blue-100 bg-blue-50/90 p-2.5"
                                    >
                                      <p className="text-[10px] font-black text-blue-700">
                                        {time(
                                          entry.startTime,
                                        )}{" "}
                                        –{" "}
                                        {time(
                                          entry.endTime,
                                        )}
                                      </p>

                                      <p className="mt-1 text-xs font-black text-[#172033]">
                                        {
                                          entry
                                            .course
                                            .name
                                        }
                                      </p>

                                      <p className="mt-0.5 text-[10px] font-bold text-[#4d6077]">
                                        {
                                          entry
                                            .course
                                            .code
                                        }

                                        {entry.faculty
                                          ? ` · ${entry.faculty}`
                                          : ""}
                                      </p>

                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#52647a]">
                                          {entry.room ||
                                            "Room pending"}
                                        </span>
                                      </div>
                                    </article>
                                  ),
                                )}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
