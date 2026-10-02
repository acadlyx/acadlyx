import { apiUrl } from "./api";
import { authedFetch, getAccessToken } from "./auth";

export interface AttendanceReportOptions {
  scope:
    | "FACULTY"
    | "DEPARTMENT"
    | "INSTITUTION";

  scopeLabel: string;

  departments: Array<{
    id: string;
    code: string;
    name: string;
  }>;

  programs: Array<{
    id: string;
    code: string;
    name: string;
    departmentId: string;
  }>;

  academicYears: Array<{
    id: string;
    name: string;
    isCurrent: boolean;
  }>;

  semesters: Array<{
    id: string;
    name: string;
    number: number;
    programId: string;
    academicYearId: string;
  }>;

  sections: Array<{
    id: string;
    name: string;
    semesterId: string;
  }>;

  courses: Array<{
    id: string;
    code: string;
    name: string;
    departmentId: string;
  }>;

  courseOfferings: Array<{
    id: string;
    courseId: string;
    semesterId: string;
    sectionId: string;
    facultyId: string | null;
    courseCode: string;
    courseName: string;
    programName: string;
    academicYearName: string;
    semesterName: string;
    sectionName: string;
    facultyName: string | null;
  }>;

  faculty: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
}

export interface AttendanceReportFilters {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  programId?: string;
  courseId?: string;
  academicYearId?: string;
  semesterId?: string;
  sectionId?: string;
  courseOfferingId?: string;
  facultyId?: string;
  status?:
    | "PRESENT"
    | "ABSENT"
    | "LATE";
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function getAttendanceReportOptions(): Promise<AttendanceReportOptions> {
  const response =
    await authedFetch<
      ApiEnvelope<AttendanceReportOptions>
    >(
      "/exports/attendance/options",
    );

  return response.data;
}

function buildQuery(
  filters: AttendanceReportFilters,
  format: "xlsx" | "csv",
): string {
  const params =
    new URLSearchParams();

  params.set(
    "format",
    format,
  );

  for (
    const [key, value] of Object.entries(
      filters,
    )
  ) {
    if (value) {
      params.set(
        key,
        value,
      );
    }
  }

  return params.toString();
}

export async function downloadAttendanceReport(
  filters: AttendanceReportFilters,
  format: "xlsx" | "csv",
): Promise<{
  filename: string;
  rowCount: number;
}> {
  const token =
    getAccessToken();

  if (!token) {
    throw new Error(
      "Authentication required",
    );
  }

  const url =
    `${apiUrl("/exports/attendance")}?${buildQuery(
      filters,
      format,
    )}`;

  let response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },
    );

  /*
   * Reuse the authenticated API's
   * token-refresh path instead of duplicating
   * refresh-token logic here.
   */
  if (
    response.status === 401
  ) {
    await authedFetch<
      ApiEnvelope<AttendanceReportOptions>
    >(
      "/exports/attendance/options",
    );

    const refreshedToken =
      getAccessToken();

    if (!refreshedToken) {
      throw new Error(
        "Authentication required",
      );
    }

    response =
      await fetch(
        url,
        {
          headers: {
            Authorization:
              `Bearer ${refreshedToken}`,
          },
        },
      );
  }

  if (!response.ok) {
    const body =
      await response
        .json()
        .catch(
          () => null,
        );

    throw new Error(
      body?.error?.message ||
        `Attendance export failed (${response.status})`,
    );
  }

  const blob =
    await response.blob();

  const disposition =
    response.headers.get(
      "Content-Disposition",
    ) || "";

  const match =
    disposition.match(
      /filename="?([^";]+)"?/i,
    );

  const filename =
    match?.[1] ||
    `acadlyx-attendance.${format}`;

  const rowCount =
    Number(
      response.headers.get(
        "X-Acadlyx-Export-Rows",
      ) || "0",
    );

  const objectUrl =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      "a",
    );

  anchor.href =
    objectUrl;

  anchor.download =
    filename;

  document.body.appendChild(
    anchor,
  );

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(
    objectUrl,
  );

  return {
    filename,
    rowCount,
  };
}
