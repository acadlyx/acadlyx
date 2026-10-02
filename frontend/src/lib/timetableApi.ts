import { authedFetch } from "@/lib/auth";

export type TimetableOffering = {
  id: string;
  courseId?: string;
  semesterId?: string | null;
  sectionId?: string | null;
  facultyId?: string | null;

  course?: {
    id?: string;
    code?: string;
    name?: string;
  };

  section?: {
    id?: string;
    name?: string;
  } | null;

  semester?: {
    id?: string;
    number?: number;
    name?: string;
    program?: {
      id?: string;
      name?: string;
      code?: string;
    };
  };

  faculty?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
};

export type TimetableEntry = {
  id: string;
  institutionId?: string;
  courseOfferingId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;

  courseOffering: TimetableOffering;
};

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

/**
 * Return the complete institution timetable visible to the
 * authenticated authority.
 *
 * Backend authorization remains the security boundary.
 */
export async function listTimetableEntries(): Promise<
  TimetableEntry[]
> {
  const response =
    await authedFetch<
      ApiEnvelope<TimetableEntry[]>
    >(
      "/erp/timetable",
    );

  return response.data;
}

/**
 * Create a timetable class.
 */
export async function createTimetableEntry(
  input: {
    courseOfferingId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
  },
): Promise<TimetableEntry> {
  const response =
    await authedFetch<
      ApiEnvelope<TimetableEntry>
    >(
      "/erp/timetable",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );

  return response.data;
}

/**
 * Update an existing timetable class.
 */
export async function updateTimetableEntry(
  id: string,
  input: {
    courseOfferingId?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    room?: string | null;
  },
): Promise<TimetableEntry> {
  const response =
    await authedFetch<
      ApiEnvelope<TimetableEntry>
    >(
      `/erp/timetable/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

  return response.data;
}

/**
 * Delete a timetable class.
 */
export async function deleteTimetableEntry(
  id: string,
): Promise<{
  id: string;
  deleted: boolean;
}> {
  const response =
    await authedFetch<
      ApiEnvelope<{
        id: string;
        deleted: boolean;
      }>
    >(
      `/erp/timetable/${id}`,
      {
        method: "DELETE",
      },
    );

  return response.data;
}

/**
 * Programs returned by the academic structure API.
 *
 * The backend already includes the owning department.
 */
export type TimetableProgram = {
  id: string;
  name: string;
  code?: string;

  department?: {
    id: string;
    name: string;
    code?: string;
  };
};

/**
 * Load programs with their departments.
 *
 * This is used only to build the timetable filters.
 */
export async function listTimetablePrograms(): Promise<
  TimetableProgram[]
> {
  const response =
    await authedFetch<
      ApiEnvelope<
        | TimetableProgram[]
        | {
            items: TimetableProgram[];
          }
      >
    >(
      "/programs?page=1&pageSize=100",
    );

  if (
    Array.isArray(
      response.data,
    )
  ) {
    return response.data;
  }

  return (
    response.data.items || []
  );
}
