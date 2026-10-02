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
  ErpOffering,
  listOfferings,
} from "@/lib/erpApi";

import {
  createTimetableEntry,
  deleteTimetableEntry,
  listTimetableEntries,
  listTimetablePrograms,
  TimetableEntry,
  TimetableProgram,
  updateTimetableEntry,
} from "@/lib/timetableApi";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type FormState = {
  courseOfferingId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
};

const EMPTY_FORM: FormState = {
  courseOfferingId: "",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "10:00",
  room: "",
};

function normalizeTime(
  value: string,
) {
  return value.slice(0, 5);
}

function addHour(
  value: string,
) {
  const [
    hours,
    minutes,
  ] = value
    .split(":")
    .map(Number);

  const total = Math.min(
    hours * 60 +
      minutes +
      60,
    23 * 60 + 59,
  );

  return `${String(
    Math.floor(
      total / 60,
    ),
  ).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

function facultyName(
  entry: TimetableEntry,
) {
  const faculty =
    entry.courseOffering
      .faculty;

  if (!faculty) {
    return "Faculty pending";
  }

  const name =
    `${faculty.firstName || ""} ${
      faculty.lastName || ""
    }`.trim();

  return name || "Faculty";
}

function offeringLabel(
  offering: ErpOffering,
) {
  const code =
    offering.course?.code ||
    "Course";

  const name =
    offering.course?.name ||
    "Unnamed course";

  const section =
    offering.section?.name
      ? ` · ${offering.section.name}`
      : "";

  const semester =
    offering.semester?.name
      ? ` · ${offering.semester.name}`
      : "";

  return `${code} — ${name}${section}${semester}`;
}

function programIdOf(
  offering: ErpOffering,
) {
  const semester =
    offering.semester as
      | (ErpOffering["semester"] & {
          program?: {
            id?: string;
          };
        })
      | undefined;

  return (
    semester?.program?.id ||
    ""
  );
}

function groupByStart(
  entries: TimetableEntry[],
) {
  const starts =
    new Set<string>();

  for (
    const entry of entries
  ) {
    starts.add(
      normalizeTime(
        entry.startTime,
      ),
    );
  }

  return [...starts].sort();
}

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
    entries,
    setEntries,
  ] = useState<
    TimetableEntry[]
  >([]);

  const [
    programs,
    setPrograms,
  ] = useState<
    TimetableProgram[]
  >([]);

  const [
    canManage,
    setCanManage,
  ] = useState(false);

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
    selectedDepartment,
    setSelectedDepartment,
  ] = useState("");

  const [
    selectedProgram,
    setSelectedProgram,
  ] = useState("");

  const [
    selectedSemester,
    setSelectedSemester,
  ] = useState("");

  const [
    selectedSection,
    setSelectedSection,
  ] = useState("");

  const [
    editingId,
    setEditingId,
  ] = useState<
    string | null
  >(null);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState<FormState>(
    EMPTY_FORM,
  );

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const user =
            await getCurrentUser();

          if (
            !user.permissions.includes(
              "timetable.read",
            )
          ) {
            setError(
              "You do not have access to the institution timetable.",
            );

            return;
          }

          setCanManage(
            user.permissions.includes(
              "timetable.manage",
            ),
          );

          const [
            offeringList,
            timetableList,
            programList,
          ] =
            await Promise.all([
              listOfferings(),
              listTimetableEntries(),
              listTimetablePrograms(),
            ]);

          setOfferings(
            offeringList,
          );

          setEntries(
            timetableList,
          );

          setPrograms(
            programList,
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
      },
      [router],
    );

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * ---------------------------------------------------------------
   * FILTER DATA
   * ---------------------------------------------------------------
   */

  const departments =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            id: string;
            name: string;
            code?: string;
          }
        >();

      for (
        const program of programs
      ) {
        if (
          program.department?.id
        ) {
          map.set(
            program.department.id,
            program.department,
          );
        }
      }

      return [
        ...map.values(),
      ].sort((a, b) =>
        a.name.localeCompare(
          b.name,
        ),
      );
    }, [programs]);

  const filteredPrograms =
    useMemo(
      () =>
        programs
          .filter(
            (program) =>
              !selectedDepartment ||
              program.department?.id ===
                selectedDepartment,
          )
          .sort((a, b) =>
            a.name.localeCompare(
              b.name,
            ),
          ),
      [
        programs,
        selectedDepartment,
      ],
    );

  const semesters =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            id: string;
            name: string;
          }
        >();

      for (
        const offering of offerings
      ) {
        if (
          offering.semester?.id
        ) {
          map.set(
            offering.semester.id,
            {
              id: offering.semester.id,
              name:
                offering
                  .semester
                  .name ||
                `Semester ${
                  offering.semester
                    .number ??
                  ""
                }`,
            },
          );
        }
      }

      return [
        ...map.values(),
      ].sort((a, b) =>
        a.name.localeCompare(
          b.name,
        ),
      );
    }, [offerings]);

  const sections =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            id: string;
            name: string;
          }
        >();

      for (
        const offering of offerings
      ) {
        if (
          !offering.section?.id
        ) {
          continue;
        }

        if (
          selectedSemester &&
          offering.semesterId !==
            selectedSemester
        ) {
          continue;
        }

        if (
          selectedProgram &&
          programIdOf(
            offering,
          ) !==
            selectedProgram
        ) {
          continue;
        }

        map.set(
          offering.section.id,
          {
            id:
              offering.section.id,
            name:
              offering.section
                .name ||
              "Section",
          },
        );
      }

      return [
        ...map.values(),
      ].sort((a, b) =>
        a.name.localeCompare(
          b.name,
        ),
      );
    }, [
      offerings,
      selectedProgram,
      selectedSemester,
    ]);

  /*
   * ---------------------------------------------------------------
   * OFFERING FILTER
   * ---------------------------------------------------------------
   */

  const filteredOfferings =
    useMemo(
      () =>
        offerings
          .filter(
            (offering) => {
              const programId =
                programIdOf(
                  offering,
                );

              const program =
                programs.find(
                  (item) =>
                    item.id ===
                    programId,
                );

              return (
                (!selectedDepartment ||
                  program?.department
                    ?.id ===
                    selectedDepartment) &&
                (!selectedProgram ||
                  programId ===
                    selectedProgram) &&
                (!selectedSemester ||
                  offering.semesterId ===
                    selectedSemester) &&
                (!selectedSection ||
                  offering.sectionId ===
                    selectedSection)
              );
            },
          )
          .sort((a, b) =>
            offeringLabel(
              a,
            ).localeCompare(
              offeringLabel(
                b,
              ),
            ),
          ),
      [
        offerings,
        programs,
        selectedDepartment,
        selectedProgram,
        selectedSemester,
        selectedSection,
      ],
    );

  const visibleOfferingIds =
    useMemo(
      () =>
        new Set(
          filteredOfferings.map(
            (offering) =>
              offering.id,
          ),
        ),
      [filteredOfferings],
    );

  const visibleEntries =
    useMemo(
      () =>
        entries.filter(
          (entry) =>
            visibleOfferingIds.has(
              entry.courseOfferingId,
            ),
        ),
      [
        entries,
        visibleOfferingIds,
      ],
    );

  /*
   * ---------------------------------------------------------------
   * DYNAMIC TIME ROWS
   * ---------------------------------------------------------------
   */

  const timeRows =
    useMemo(
      () =>
        groupByStart(
          visibleEntries,
        ),
      [visibleEntries],
    );

  function entriesForCell(
    day: number,
    start: string,
  ) {
    return visibleEntries.filter(
      (entry) =>
        entry.dayOfWeek ===
          day &&
        normalizeTime(
          entry.startTime,
        ) === start,
    );
  }

  /*
   * ---------------------------------------------------------------
   * FILTER ACTIONS
   * ---------------------------------------------------------------
   */

  function resetFilters() {
    setSelectedDepartment(
      "",
    );

    setSelectedProgram(
      "",
    );

    setSelectedSemester(
      "",
    );

    setSelectedSection(
      "",
    );
  }

  /*
   * ---------------------------------------------------------------
   * CREATE / EDIT
   * ---------------------------------------------------------------
   */

  function openCreate(
    day = 1,
    start = "09:00",
  ) {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
      courseOfferingId:
        filteredOfferings[0]
          ?.id || "",
      dayOfWeek: day,
      startTime: start,
      endTime:
        addHour(start),
    });

    setError("");
    setSuccess("");

    setModalOpen(true);
  }

  function openEdit(
    entry: TimetableEntry,
  ) {
    setEditingId(
      entry.id,
    );

    setForm({
      courseOfferingId:
        entry.courseOfferingId,
      dayOfWeek:
        entry.dayOfWeek,
      startTime:
        normalizeTime(
          entry.startTime,
        ),
      endTime:
        normalizeTime(
          entry.endTime,
        ),
      room:
        entry.room || "",
    });

    setError("");
    setSuccess("");

    setModalOpen(true);
  }

  async function save() {
    if (
      !form.courseOfferingId
    ) {
      setError(
        "Select a course offering first.",
      );

      return;
    }

    if (
      form.endTime <=
      form.startTime
    ) {
      setError(
        "End time must be after start time.",
      );

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editingId) {
        await updateTimetableEntry(
          editingId,
          {
            courseOfferingId:
              form.courseOfferingId,
            dayOfWeek:
              form.dayOfWeek,
            startTime:
              form.startTime,
            endTime:
              form.endTime,
            room:
              form.room.trim() ||
              null,
          },
        );

        setSuccess(
          "Timetable class updated successfully.",
        );
      } else {
        await createTimetableEntry(
          {
            courseOfferingId:
              form.courseOfferingId,
            dayOfWeek:
              form.dayOfWeek,
            startTime:
              form.startTime,
            endTime:
              form.endTime,
            room:
              form.room.trim() ||
              undefined,
          },
        );

        setSuccess(
          "Class scheduled successfully.",
        );
      }

      setModalOpen(false);

      await load();
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to save timetable class.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(
    entry: TimetableEntry,
  ) {
    const confirmed =
      window.confirm(
        `Remove ${
          entry.courseOffering
            .course?.name ||
          "this class"
        } from the timetable?`,
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await deleteTimetableEntry(
        entry.id,
      );

      setSuccess(
        "Class removed from the timetable.",
      );

      setModalOpen(false);

      await load();
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to delete timetable class.",
      );
    }
  }

  /*
   * ---------------------------------------------------------------
   * UI
   * ---------------------------------------------------------------
   */

  return (
    <DashboardShell
      title="Timetable"
      subtitle="Dynamic weekly class scheduling"
      allowedRoles={[
        "CHAIRMAN",
        "DIRECTOR",
        "DEAN",
        "HOD",
        "FACULTY",
      ]}
    >
      <div className="space-y-5 pb-10">
        {/* HEADER */}
        <section className="rounded-[24px] border border-[#dfe7ee] bg-white p-5 shadow-[0_8px_28px_rgba(20,32,50,0.04)] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2864e8]">
                Academic scheduling
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#172033]">
                Weekly timetable
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#718298]">
                Time rows are generated
                from the classes that are
                actually scheduled. Different
                departments, programs,
                semesters and sections can
                therefore use completely
                different time slots.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void load()
                }
                className="rounded-xl border border-[#d9e2ea] bg-white px-4 py-2.5 text-sm font-extrabold text-[#334155] hover:border-[#b9c8d8] hover:bg-[#f7f9fb]"
              >
                Refresh
              </button>

              {canManage ? (
                <button
                  type="button"
                  onClick={() =>
                    openCreate()
                  }
                  className="rounded-xl bg-[#2864e8] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_7px_16px_rgba(40,100,232,0.18)] hover:bg-[#1f57d0]"
                >
                  + Schedule class
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* MESSAGES */}
        {error ? (
          <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        ) : null}

        {/* FILTERS */}
        <section className="rounded-[24px] border border-[#dfe7ee] bg-white p-4 shadow-[0_8px_28px_rgba(20,32,50,0.04)] sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#7b8b9e]">
                Department
              </span>

              <select
                value={
                  selectedDepartment
                }
                onChange={(
                  event,
                ) => {
                  setSelectedDepartment(
                    event.target.value,
                  );

                  setSelectedProgram(
                    "",
                  );

                  setSelectedSection(
                    "",
                  );
                }}
                className="w-full rounded-xl border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm font-semibold text-[#26354b] outline-none focus:border-[#2864e8]"
              >
                <option value="">
                  All departments
                </option>

                {departments.map(
                  (
                    department,
                  ) => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >
                      {
                        department.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#7b8b9e]">
                Program
              </span>

              <select
                value={
                  selectedProgram
                }
                onChange={(
                  event,
                ) => {
                  setSelectedProgram(
                    event.target.value,
                  );

                  setSelectedSection(
                    "",
                  );
                }}
                className="w-full rounded-xl border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm font-semibold text-[#26354b] outline-none focus:border-[#2864e8]"
              >
                <option value="">
                  All programs
                </option>

                {filteredPrograms.map(
                  (
                    program,
                  ) => (
                    <option
                      key={
                        program.id
                      }
                      value={
                        program.id
                      }
                    >
                      {program.code
                        ? `${program.code} — `
                        : ""}
                      {
                        program.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#7b8b9e]">
                Semester
              </span>

              <select
                value={
                  selectedSemester
                }
                onChange={(
                  event,
                ) => {
                  setSelectedSemester(
                    event.target.value,
                  );

                  setSelectedSection(
                    "",
                  );
                }}
                className="w-full rounded-xl border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm font-semibold text-[#26354b] outline-none focus:border-[#2864e8]"
              >
                <option value="">
                  All semesters
                </option>

                {semesters.map(
                  (
                    semester,
                  ) => (
                    <option
                      key={
                        semester.id
                      }
                      value={
                        semester.id
                      }
                    >
                      {
                        semester.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#7b8b9e]">
                Section
              </span>

              <select
                value={
                  selectedSection
                }
                onChange={(
                  event,
                ) =>
                  setSelectedSection(
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm font-semibold text-[#26354b] outline-none focus:border-[#2864e8]"
              >
                <option value="">
                  All sections
                </option>

                {sections.map(
                  (
                    section,
                  ) => (
                    <option
                      key={
                        section.id
                      }
                      value={
                        section.id
                      }
                    >
                      {
                        section.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f5] pt-3">
            <p className="text-xs font-semibold text-[#718298]">
              {
                visibleEntries.length
              }{" "}
              scheduled class
              {visibleEntries.length ===
              1
                ? ""
                : "es"}{" "}
              ·{" "}
              {
                filteredOfferings.length
              }{" "}
              course offering
              {filteredOfferings.length ===
              1
                ? ""
                : "s"}
            </p>

            <button
              type="button"
              onClick={
                resetFilters
              }
              className="text-xs font-extrabold text-[#2864e8] hover:underline"
            >
              Clear filters
            </button>
          </div>
        </section>

        {/* CALENDAR */}
        <section className="overflow-hidden rounded-[24px] border border-[#dfe7ee] bg-white shadow-[0_8px_28px_rgba(20,32,50,0.04)]">
          <div className="border-b border-[#e8edf2] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-black text-[#243149]">
                  Weekly schedule
                </h2>

                <p className="mt-0.5 text-xs text-[#8a99ab]">
                  Each row is generated
                  from an actual scheduled
                  start time.
                </p>
              </div>

              {canManage ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                  Scheduling enabled
                </span>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4].map(
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
                No classes scheduled
                for this view
              </p>

              <p className="mt-1 text-sm text-[#718298]">
                Choose different
                filters or schedule
                the first class.
              </p>

              {canManage ? (
                <button
                  type="button"
                  onClick={() =>
                    openCreate()
                  }
                  className="mt-4 rounded-xl bg-[#2864e8] px-4 py-2.5 text-sm font-extrabold text-white"
                >
                  Schedule class
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1120px]">
                {/* DAY HEADERS */}
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

                {/* TIME ROWS */}
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
                          dayIndex,
                        ) => {
                          const cellEntries =
                            entriesForCell(
                              dayIndex,
                              start,
                            );

                          return (
                            <div
                              key={`${start}-${dayIndex}`}
                              className="min-h-[112px] border-r border-[#edf1f5] p-1.5 last:border-r-0"
                            >
                              <div className="space-y-1.5">
                                {cellEntries.map(
                                  (
                                    entry,
                                  ) => (
                                    <button
                                      key={
                                        entry.id
                                      }
                                      type="button"
                                      onClick={() =>
                                        canManage
                                          ? openEdit(
                                              entry,
                                            )
                                          : undefined
                                      }
                                      className={`w-full rounded-xl border border-blue-100 bg-blue-50/90 p-2.5 text-left ${
                                        canManage
                                          ? "cursor-pointer hover:border-blue-300 hover:bg-blue-50"
                                          : "cursor-default"
                                      }`}
                                    >
                                      <p className="text-[10px] font-black text-blue-700">
                                        {normalizeTime(
                                          entry.startTime,
                                        )}{" "}
                                        –{" "}
                                        {normalizeTime(
                                          entry.endTime,
                                        )}
                                      </p>

                                      <p className="mt-1 truncate text-xs font-black text-[#172033]">
                                        {entry
                                          .courseOffering
                                          .course
                                          ?.code ||
                                          "Course"}
                                      </p>

                                      <p className="truncate text-[10px] font-bold text-[#4d6077]">
                                        {entry
                                          .courseOffering
                                          .course
                                          ?.name ||
                                          "Unnamed course"}
                                      </p>

                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        {entry
                                          .courseOffering
                                          .section
                                          ?.name ? (
                                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#52647a]">
                                            {
                                              entry
                                                .courseOffering
                                                .section
                                                .name
                                            }
                                          </span>
                                        ) : null}

                                        {entry.room ? (
                                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#52647a]">
                                            {
                                              entry.room
                                            }
                                          </span>
                                        ) : null}
                                      </div>

                                      <p className="mt-1 truncate text-[9px] text-[#7b8b9e]">
                                        {facultyName(
                                          entry,
                                        )}
                                      </p>
                                    </button>
                                  ),
                                )}

                                {canManage ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openCreate(
                                        dayIndex,
                                        start,
                                      )
                                    }
                                    className="w-full rounded-lg border border-dashed border-[#d7e0e8] px-2 py-1.5 text-[10px] font-bold text-[#94a3b8] hover:border-blue-300 hover:text-blue-600"
                                  >
                                    + Add class
                                  </button>
                                ) : null}
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

        {/* EDITOR MODAL */}
        {modalOpen ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-[#dfe7ee] bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-[#e8edf2] px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2864e8]">
                    Timetable editor
                  </p>

                  <h2 className="mt-1 text-xl font-black text-[#172033]">
                    {editingId
                      ? "Edit class"
                      : "Schedule class"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(
                      false,
                    )
                  }
                  className="rounded-xl px-3 py-2 text-sm font-black text-[#718298] hover:bg-[#f4f7fa]"
                >
                  ✕
                </button>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#7b8b9e]">
                    Class / course offering
                  </span>

                  <select
                    value={
                      form.courseOfferingId
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          courseOfferingId:
                            event.target
                              .value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-[#d9e2ea] bg-white px-3 py-3 text-sm font-semibold text-[#26354b] outline-none focus:border-[#2864e8]"
                  >
                    <option value="">
                      Select a course
                      offering
                    </option>

                    {filteredOfferings.map(
                      (
                        offering,
                      ) => (
                        <option
                          key={
                            offering.id
                          }
                          value={
                            offering.id
                          }
                        >
                          {offeringLabel(
                            offering,
                          )}
                        </option>
                      ),
                    )}
                  </select>

                  <p className="mt-1.5 text-[11px] text-[#8a99ab]">
                    The course offering
                    already identifies
                    its program,
                    semester, section
                    and assigned
                    faculty.
                  </p>
                </label>

                <label>
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#7b8b9e]">
                    Day
                  </span>

                  <select
                    value={
                      form.dayOfWeek
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          dayOfWeek:
                            Number(
                              event
                                .target
                                .value,
                            ),
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-[#d9e2ea] bg-white px-3 py-3 text-sm font-semibold text-[#26354b] outline-none focus:border-[#2864e8]"
                  >
                    {DAYS.map(
                      (
                        day,
                        index,
                      ) => (
                        <option
                          key={day}
                          value={index}
                        >
                          {day}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#7b8b9e]">
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
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Room / Lab"
                    className="w-full rounded-xl border border-[#d9e2ea] px-3 py-3 text-sm font-semibold outline-none focus:border-[#2864e8]"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#7b8b9e]">
                    Start time
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
                            event.target
                              .value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-[#d9e2ea] px-3 py-3 text-sm font-semibold outline-none focus:border-[#2864e8]"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#7b8b9e]">
                    End time
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
                            event.target
                              .value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-[#d9e2ea] px-3 py-3 text-sm font-semibold outline-none focus:border-[#2864e8]"
                  />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[#e8edf2] px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
                <div>
                  {editingId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const entry =
                          entries.find(
                            (item) =>
                              item.id ===
                              editingId,
                          );

                        if (entry) {
                          void remove(
                            entry,
                          );
                        }
                      }}
                      className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-red-600 hover:bg-red-50"
                    >
                      Delete class
                    </button>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setModalOpen(
                        false,
                      )
                    }
                    className="rounded-xl border border-[#d9e2ea] px-4 py-2.5 text-sm font-extrabold text-[#52647a]"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      void save()
                    }
                    className="rounded-xl bg-[#2864e8] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                  >
                    {saving
                      ? "Saving…"
                      : editingId
                        ? "Save changes"
                        : "Schedule class"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
