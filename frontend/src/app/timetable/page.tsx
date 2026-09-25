"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";

import {
  AuthRequiredError,
  getCurrentUser,
} from "@/lib/auth";

import {
  createTimetableEntry,
  ErpOffering,
  getErpWorkspace,
  listOfferings,
} from "@/lib/erpApi";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function TimetablePage() {
  const router =
    useRouter();

  const [
    offerings,
    setOfferings,
  ] = useState<
    ErpOffering[]
  >([]);

  const [
    entryCount,
    setEntryCount,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    canManage,
    setCanManage,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState({
    courseOfferingId:
      "",
    dayOfWeek:
      "1",
    startTime:
      "09:00",
    endTime:
      "10:00",
    room:
      "",
  });

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const user =
            await getCurrentUser();

          if (
            !user.roles.includes(
              "INSTITUTION_ADMIN",
            )
          ) {
            router.replace(
              "/login",
            );

            return;
          }

          setCanManage(
            user.permissions.includes(
              "timetable.manage",
            ),
          );

          const [
            workspace,
            offeringList,
          ] =
            await Promise.all([
              getErpWorkspace(),
              listOfferings(),
            ]);

          setEntryCount(
            workspace.stats
              ?.timetableEntries ??
              0,
          );

          setOfferings(
            offeringList,
          );

          if (
            !form.courseOfferingId &&
            offeringList[0]
          ) {
            setForm(
              (current) => ({
                ...current,
                courseOfferingId:
                  offeringList[0].id,
              }),
            );
          }
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
          setLoading(
            false,
          );
        }
      },
      [
        router,
        form.courseOfferingId,
      ],
    );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedOffering =
    useMemo(
      () =>
        offerings.find(
          (item) =>
            item.id ===
            form.courseOfferingId,
        ),
      [
        offerings,
        form.courseOfferingId,
      ],
    );

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createTimetableEntry(
        {
          courseOfferingId:
            form.courseOfferingId,
          dayOfWeek:
            Number(
              form.dayOfWeek,
            ),
          startTime:
            form.startTime,
          endTime:
            form.endTime,
          room:
            form.room ||
            undefined,
        },
      );

      setSuccess(
        "Timetable entry saved successfully.",
      );

      await load();
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to save timetable entry.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  return (
    <DashboardShell
      title="Timetable"
      subtitle="Institution schedules and course sessions"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <section className="rounded-[26px] border border-[#dfe7ee] bg-white p-5 shadow-[0_8px_28px_rgba(20,32,50,0.04)] sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2864e8]">
                Institution scheduling
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#172033]">
                Timetable
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718298]">
                Create institution timetable
                entries without exposing
                examination, finance or other
                specialist controls.
              </p>
            </div>

            <div className="rounded-[18px] bg-[#f4f7fa] px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#92a1b4]">
                Scheduled entries
              </p>

              <p className="mt-1 text-2xl font-black text-[#172033]">
                {loading
                  ? "—"
                  : entryCount}
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="rounded-[26px] border border-[#dfe7ee] bg-white p-5 shadow-[0_8px_28px_rgba(20,32,50,0.04)] sm:p-7">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#92a1b4]">
              Schedule builder
            </p>

            <h2 className="mt-1 text-lg font-black text-[#243149]">
              Add timetable entry
            </h2>
          </div>

          {!canManage ? (
            <div className="rounded-[18px] border border-[#dfe7ee] bg-[#f7f9fb] p-5 text-sm leading-6 text-[#718298]">
              This account can view timetable
              information but does not have
              timetable management authority.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="lg:col-span-2">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                  Course offering
                </span>

                <select
                  value={
                    form.courseOfferingId
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        courseOfferingId:
                          event.target.value,
                      }),
                    )
                  }
                  className="w-full rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                >
                  {offerings.map(
                    (item) => (
                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.course
                          ?.code ||
                          "Course"}{" "}
                        —{" "}
                        {item.course
                          ?.name ||
                          item.id}
                        {item.section
                          ?.name
                          ? ` · ${item.section.name}`
                          : ""}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                  Day
                </span>

                <select
                  value={
                    form.dayOfWeek
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        dayOfWeek:
                          event.target.value,
                      }),
                    )
                  }
                  className="w-full rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                >
                  {DAYS.map(
                    (
                      day,
                      index,
                    ) => (
                      <option
                        key={
                          day
                        }
                        value={
                          index +
                          1
                        }
                      >
                        {day}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                  Start
                </span>

                <input
                  type="time"
                  value={
                    form.startTime
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        startTime:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className="w-full rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                  End
                </span>

                <input
                  type="time"
                  value={
                    form.endTime
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        endTime:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className="w-full rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                />
              </label>

              <label className="sm:col-span-2 lg:col-span-3">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                  Room
                </span>

                <input
                  value={
                    form.room
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        room:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="e.g. Room 204"
                  className="w-full rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                />
              </label>

              <div className="flex items-end lg:col-span-2">
                <button
                  type="button"
                  disabled={
                    saving ||
                    !form.courseOfferingId ||
                    !selectedOffering
                  }
                  onClick={() =>
                    void save()
                  }
                  className="w-full rounded-[13px] bg-[#2864e8] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_7px_16px_rgba(40,100,232,0.18)] transition hover:bg-[#1f57d0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving…"
                    : "Save timetable entry"}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
