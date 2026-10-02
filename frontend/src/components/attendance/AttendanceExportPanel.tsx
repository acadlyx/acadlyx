"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AuthRequiredError,
} from "@/lib/auth";

import {
  AttendanceReportFilters,
  AttendanceReportOptions,
  downloadAttendanceReport,
  getAttendanceReportOptions,
} from "@/lib/attendanceReportApi";

const EMPTY_FILTERS: AttendanceReportFilters = {};

type SelectOption = {
  value: string;
  label: string;
};

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  options: SelectOption[];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        disabled={disabled}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">
          All
        </option>

        {options.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

export function AttendanceExportPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [
    options,
    setOptions,
  ] =
    useState<AttendanceReportOptions | null>(
      null,
    );

  const [
    filters,
    setFilters,
  ] =
    useState<AttendanceReportFilters>(
      EMPTY_FILTERS,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    downloading,
    setDownloading,
  ] =
    useState<
      "xlsx" | "csv" | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    expanded,
    setExpanded,
  ] =
    useState(!compact);

  useEffect(() => {
    if (
      (compact && !expanded) ||
      options
    ) {
      return;
    }

    let alive = true;

    getAttendanceReportOptions()
      .then((data) => {
        if (!alive) {
          return;
        }

        setOptions(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) {
          return;
        }

        if (
          err instanceof
          AuthRequiredError
        ) {
          window.location.href =
            "/login";

          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load attendance report filters.",
        );

        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [
    compact,
    expanded,
    options,
  ]);

  const visiblePrograms =
    useMemo(() => {
      if (!options) {
        return [];
      }

      return options.programs.filter(
        (item) =>
          !filters.departmentId ||
          item.departmentId ===
            filters.departmentId,
      );
    }, [
      filters.departmentId,
      options,
    ]);

  const visibleCourses =
    useMemo(() => {
      if (!options) {
        return [];
      }

      return options.courses.filter(
        (item) =>
          !filters.departmentId ||
          item.departmentId ===
            filters.departmentId,
      );
    }, [
      filters.departmentId,
      options,
    ]);

  const visibleSemesters =
    useMemo(() => {
      if (!options) {
        return [];
      }

      return options.semesters.filter(
        (item) => {
          if (
            filters.programId &&
            item.programId !==
              filters.programId
          ) {
            return false;
          }

          if (
            filters.academicYearId &&
            item.academicYearId !==
              filters.academicYearId
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      filters.academicYearId,
      filters.programId,
      options,
    ]);

  const visibleSections =
    useMemo(() => {
      if (!options) {
        return [];
      }

      return options.sections.filter(
        (item) =>
          !filters.semesterId ||
          item.semesterId ===
            filters.semesterId,
      );
    }, [
      filters.semesterId,
      options,
    ]);

  const visibleOfferings =
    useMemo(() => {
      if (!options) {
        return [];
      }

      return options.courseOfferings.filter(
        (item) => {
          if (
            filters.departmentId
          ) {
            const course =
              options.courses.find(
                (candidate) =>
                  candidate.id ===
                  item.courseId,
              );

            if (
              course?.departmentId !==
              filters.departmentId
            ) {
              return false;
            }
          }

          if (
            filters.courseId &&
            item.courseId !==
              filters.courseId
          ) {
            return false;
          }

          if (
            filters.programId
          ) {
            const semester =
              options.semesters.find(
                (candidate) =>
                  candidate.id ===
                  item.semesterId,
              );

            if (
              semester?.programId !==
              filters.programId
            ) {
              return false;
            }
          }

          if (
            filters.academicYearId
          ) {
            const semester =
              options.semesters.find(
                (candidate) =>
                  candidate.id ===
                  item.semesterId,
              );

            if (
              semester?.academicYearId !==
              filters.academicYearId
            ) {
              return false;
            }
          }

          if (
            filters.semesterId &&
            item.semesterId !==
              filters.semesterId
          ) {
            return false;
          }

          if (
            filters.sectionId &&
            item.sectionId !==
              filters.sectionId
          ) {
            return false;
          }

          if (
            filters.facultyId &&
            item.facultyId !==
              filters.facultyId
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      filters.academicYearId,
      filters.courseId,
      filters.departmentId,
      filters.facultyId,
      filters.programId,
      filters.sectionId,
      filters.semesterId,
      options,
    ]);

  function updateFilter<
    K extends keyof AttendanceReportFilters
  >(
    key: K,
    value: AttendanceReportFilters[K],
  ) {
    setMessage("");

    setFilters(
      (current) => ({
        ...current,
        [key]:
          value ||
          undefined,
      }),
    );
  }

  function resetFilters() {
    setFilters({});
    setMessage("");
    setError("");
  }

  async function download(
    format: "xlsx" | "csv",
  ) {
    setDownloading(format);
    setMessage("");
    setError("");

    try {
      const result =
        await downloadAttendanceReport(
          filters,
          format,
        );

      setMessage(
        result.rowCount > 0
          ? `${result.rowCount.toLocaleString()} attendance records exported.`
          : "The export was created, but no submitted attendance records matched these filters.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Attendance export failed.",
      );
    } finally {
      setDownloading(null);
    }
  }

  const facultyScope =
    options?.scope ===
    "FACULTY";

  const leadershipScope =
    !facultyScope &&
    Boolean(options);

  if (
    compact &&
    !expanded
  ) {
    return (
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() =>
            setExpanded(true)
          }
          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-100"
        >
          <span aria-hidden="true">
            ↓
          </span>

          Attendance export
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
            Attendance reports
          </p>

          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
            Download attendance
          </h2>

          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            {options?.scopeLabel ||
              "Only attendance records inside your authorised scope can be exported."}

            {facultyScope
              ? " Your export is limited to classes assigned to you."
              : " Use the filters to narrow the report before downloading."}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {options ? (
            <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              {options.scope ===
              "FACULTY"
                ? "Faculty scope"
                : options.scope ===
                    "DEPARTMENT"
                  ? "Department scope"
                  : "Institution scope"}
            </span>
          ) : null}

          {compact ? (
            <button
              type="button"
              onClick={() =>
                setExpanded(false)
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map(
            (item) => (
              <div
                key={item}
                className="h-10 animate-pulse rounded-xl bg-slate-100"
              />
            ),
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {options ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">
                Date from
              </span>

              <input
                type="date"
                value={
                  filters.dateFrom ||
                  ""
                }
                onChange={(
                  event,
                ) =>
                  updateFilter(
                    "dateFrom",
                    event.target
                      .value,
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">
                Date to
              </span>

              <input
                type="date"
                value={
                  filters.dateTo ||
                  ""
                }
                onChange={(
                  event,
                ) =>
                  updateFilter(
                    "dateTo",
                    event.target
                      .value,
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <SelectField
              label="Status"
              value={
                filters.status ||
                ""
              }
              onChange={(
                value,
              ) =>
                updateFilter(
                  "status",
                  value as AttendanceReportFilters["status"],
                )
              }
              options={[
                {
                  value:
                    "PRESENT",
                  label:
                    "Present",
                },
                {
                  value:
                    "ABSENT",
                  label:
                    "Absent",
                },
                {
                  value:
                    "LATE",
                  label:
                    "Late",
                },
              ]}
            />

            {leadershipScope ? (
              <>
                <SelectField
                  label="Department"
                  value={
                    filters.departmentId ||
                    ""
                  }
                  onChange={(
                    value,
                  ) => {
                    setFilters(
                      (current) => ({
                        ...current,

                        departmentId:
                          value ||
                          undefined,

                        programId:
                          undefined,

                        courseId:
                          undefined,

                        sectionId:
                          undefined,

                        courseOfferingId:
                          undefined,

                        facultyId:
                          undefined,
                      }),
                    );
                  }}
                  options={options.departments.map(
                    (item) => ({
                      value:
                        item.id,

                      label:
                        `${item.code} · ${item.name}`,
                    }),
                  )}
                />

                <SelectField
                  label="Program"
                  value={
                    filters.programId ||
                    ""
                  }
                  onChange={(
                    value,
                  ) => {
                    setFilters(
                      (current) => ({
                        ...current,

                        programId:
                          value ||
                          undefined,

                        semesterId:
                          undefined,

                        sectionId:
                          undefined,

                        courseOfferingId:
                          undefined,
                      }),
                    );
                  }}
                  options={visiblePrograms.map(
                    (item) => ({
                      value:
                        item.id,

                      label:
                        `${item.code} · ${item.name}`,
                    }),
                  )}
                />

                <SelectField
                  label="Academic year"
                  value={
                    filters.academicYearId ||
                    ""
                  }
                  onChange={(
                    value,
                  ) => {
                    setFilters(
                      (current) => ({
                        ...current,

                        academicYearId:
                          value ||
                          undefined,

                        semesterId:
                          undefined,

                        sectionId:
                          undefined,

                        courseOfferingId:
                          undefined,
                      }),
                    );
                  }}
                  options={options.academicYears.map(
                    (item) => ({
                      value:
                        item.id,

                      label:
                        item.isCurrent
                          ? `${item.name} · Current`
                          : item.name,
                    }),
                  )}
                />

                <SelectField
                  label="Semester"
                  value={
                    filters.semesterId ||
                    ""
                  }
                  onChange={(
                    value,
                  ) => {
                    setFilters(
                      (current) => ({
                        ...current,

                        semesterId:
                          value ||
                          undefined,

                        sectionId:
                          undefined,

                        courseOfferingId:
                          undefined,
                      }),
                    );
                  }}
                  options={visibleSemesters.map(
                    (item) => ({
                      value:
                        item.id,

                      label:
                        item.name,
                    }),
                  )}
                />

                <SelectField
                  label="Section"
                  value={
                    filters.sectionId ||
                    ""
                  }
                  onChange={(
                    value,
                  ) =>
                    setFilters(
                      (current) => ({
                        ...current,

                        sectionId:
                          value ||
                          undefined,

                        courseOfferingId:
                          undefined,
                      }),
                    )
                  }
                  options={visibleSections.map(
                    (item) => ({
                      value:
                        item.id,

                      label:
                        item.name,
                    }),
                  )}
                />

                <SelectField
                  label="Course"
                  value={
                    filters.courseId ||
                    ""
                  }
                  onChange={(
                    value,
                  ) => {
                    setFilters(
                      (current) => ({
                        ...current,

                        courseId:
                          value ||
                          undefined,

                        courseOfferingId:
                          undefined,
                      }),
                    );
                  }}
                  options={visibleCourses.map(
                    (item) => ({
                      value:
                        item.id,

                      label:
                        `${item.code} · ${item.name}`,
                    }),
                  )}
                />

                <SelectField
                  label="Faculty"
                  value={
                    filters.facultyId ||
                    ""
                  }
                  onChange={(
                    value,
                  ) => {
                    setFilters(
                      (current) => ({
                        ...current,

                        facultyId:
                          value ||
                          undefined,

                        courseOfferingId:
                          undefined,
                      }),
                    );
                  }}
                  options={options.faculty.map(
                    (item) => ({
                      value:
                        item.id,

                      label:
                        `${item.firstName} ${item.lastName}`.trim(),
                    }),
                  )}
                />

                <SelectField
                  label="Class offering"
                  value={
                    filters.courseOfferingId ||
                    ""
                  }
                  onChange={(
                    value,
                  ) =>
                    updateFilter(
                      "courseOfferingId",
                      value,
                    )
                  }
                  options={visibleOfferings.map(
                    (item) => ({
                      value:
                        item.id,

                      label:
                        `${item.courseCode} · ${item.sectionName} · ${item.semesterName}`,
                    }),
                  )}
                />
              </>
            ) : (
              <SelectField
                label="My class"
                value={
                  filters.courseOfferingId ||
                  ""
                }
                onChange={(
                  value,
                ) =>
                  updateFilter(
                    "courseOfferingId",
                    value,
                  )
                }
                options={options.courseOfferings.map(
                  (item) => ({
                    value:
                      item.id,

                    label:
                      `${item.courseCode} · ${item.sectionName}`,
                  }),
                )}
              />
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Only submitted attendance
              sessions are exported.

              {options.scope ===
              "DEPARTMENT"
                ? " HOD exports are restricted to assigned departments."
                : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={
                  resetFilters
                }
                disabled={
                  downloading !==
                  null
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Reset filters
              </button>

              <button
                type="button"
                onClick={() =>
                  void download(
                    "csv",
                  )
                }
                disabled={
                  downloading !==
                  null
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {downloading ===
                "csv"
                  ? "Preparing CSV…"
                  : "Download CSV"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void download(
                    "xlsx",
                  )
                }
                disabled={
                  downloading !==
                  null
                }
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {downloading ===
                "xlsx"
                  ? "Preparing XLSX…"
                  : "Download XLSX"}
              </button>
            </div>
          </div>

          {message ? (
            <p className="mt-3 text-right text-xs font-semibold text-emerald-700">
              {message}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
