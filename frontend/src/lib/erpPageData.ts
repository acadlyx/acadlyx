"use client";

import {
  AuthRequiredError,
  getCurrentUser,
} from "@/lib/auth";

import {
  clearErpClientCache,
  getErpWorkspace,
  getMyDocuments,
  getNotifications,
  listAcademicYears,
  listDepartments,
  listFeeHeads,
  listFeeStructures,
  listOfferings,
  listPrograms,
  listSemesters,
  listUsers,
} from "@/lib/erpApi";

export type ErpPageData = {
  roles: string[];

  workspace: Record<
    string,
    unknown
  > | null;

  offerings: Awaited<
    ReturnType<typeof listOfferings>
  >;

  students: Awaited<
    ReturnType<typeof listUsers>
  >;

  parents: Awaited<
    ReturnType<typeof listUsers>
  >;

  departments: Awaited<
    ReturnType<typeof listDepartments>
  >;

  academicYears: Awaited<
    ReturnType<typeof listAcademicYears>
  >;

  programs: Awaited<
    ReturnType<typeof listPrograms>
  >;

  semesters: Awaited<
    ReturnType<typeof listSemesters>
  >;

  feeHeads: Awaited<
    ReturnType<typeof listFeeHeads>
  >;

  feeStructures: Awaited<
    ReturnType<typeof listFeeStructures>
  >;

  notifications: Awaited<
    ReturnType<typeof getNotifications>
  >;

  documents: Awaited<
    ReturnType<typeof getMyDocuments>
  >;
};

export type ErpDataSetter = (
  updater: (
    current: ErpPageData
  ) => ErpPageData
) => void;

export function emptyErpPageData(): ErpPageData {
  return {
    roles: [],
    workspace: null,
    offerings: [],
    students: [],
    parents: [],
    departments: [],
    academicYears: [],
    programs: [],
    semesters: [],
    feeHeads: [],
    feeStructures: [],
    notifications: {
      items: [],
      unread: 0,
      pagination: {},
    },
    documents: [],
  };
}

/**
 * Loads only what is needed to paint the first ERP screen.
 *
 * IMPORTANT:
 * Overview does not require students, parents, fee structures,
 * documents, etc.
 *
 * Therefore those datasets are intentionally deferred.
 */
export async function loadErpCriticalData(
  signal?: AbortSignal
): Promise<{
  user: Awaited<
    ReturnType<typeof getCurrentUser>
  >;

  workspace: Awaited<
    ReturnType<typeof getErpWorkspace>
  >;
}> {
  if (signal?.aborted) {
    throw new DOMException(
      "ERP load aborted",
      "AbortError"
    );
  }

  const user =
    await getCurrentUser();

  if (
    !user.institutionId &&
    !user.roles.includes(
      "SUPER_ADMIN"
    )
  ) {
    throw new Error(
      "No institution is assigned to this account."
    );
  }

  if (signal?.aborted) {
    throw new DOMException(
      "ERP load aborted",
      "AbortError"
    );
  }

  const workspace =
    await getErpWorkspace();

  return {
    user,
    workspace,
  };
}

/**
 * Loads the supporting data needed by the
 * operational tabs.
 *
 * These requests are deliberately independent.
 * One failed secondary resource must not destroy
 * the entire ERP screen.
 */
export async function loadErpSecondaryData(
  options: {
    includeStudents?: boolean;
    includeParents?: boolean;
    includeAcademic?: boolean;
    includeFees?: boolean;
    includeDocuments?: boolean;
    includeNotifications?: boolean;
    includeOfferings?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<
  Partial<ErpPageData>
> {
  const {
    includeStudents = false,
    includeParents = false,
    includeAcademic = false,
    includeFees = false,
    includeDocuments = false,
    includeNotifications = false,
    includeOfferings = false,
    signal,
  } = options;

  const jobs: Array<
    Promise<{
      key: keyof ErpPageData;
      value: unknown;
    }>
  > = [];

  if (includeOfferings) {
    jobs.push(
      listOfferings().then(
        (value) => ({
          key: "offerings",
          value,
        })
      )
    );
  }

  if (includeStudents) {
    jobs.push(
      listUsers("STUDENT").then(
        (value) => ({
          key: "students",
          value,
        })
      )
    );
  }

  if (includeParents) {
    jobs.push(
      listUsers("PARENT").then(
        (value) => ({
          key: "parents",
          value,
        })
      )
    );
  }

  if (includeAcademic) {
    jobs.push(
      Promise.all([
        listDepartments(),
        listAcademicYears(),
        listPrograms(),
        listSemesters(),
      ]).then(
        ([
          departments,
          academicYears,
          programs,
          semesters,
        ]) => ({
          key: "departments",
          value: {
            departments,
            academicYears,
            programs,
            semesters,
          },
        })
      )
    );
  }

  if (includeFees) {
    jobs.push(
      Promise.all([
        listFeeHeads(),
        listFeeStructures(),
      ]).then(
        ([
          feeHeads,
          feeStructures,
        ]) => ({
          key: "feeHeads",
          value: {
            feeHeads,
            feeStructures,
          },
        })
      )
    );
  }

  if (includeNotifications) {
    jobs.push(
      getNotifications().then(
        (value) => ({
          key: "notifications",
          value,
        })
      )
    );
  }

  if (includeDocuments) {
    jobs.push(
      getMyDocuments().then(
        (value) => ({
          key: "documents",
          value,
        })
      )
    );
  }

  if (
    signal?.aborted
  ) {
    throw new DOMException(
      "ERP load aborted",
      "AbortError"
    );
  }

  const settled =
    await Promise.allSettled(
      jobs
    );

  const output: Partial<ErpPageData> =
    {};

  for (
    const result of settled
  ) {
    if (
      result.status !==
      "fulfilled"
    ) {
      continue;
    }

    const {
      key,
      value,
    } = result.value;

    if (
      key === "departments" &&
      value &&
      typeof value === "object" &&
      "departments" in value
    ) {
      const academic =
        value as {
          departments: Awaited<
            ReturnType<
              typeof listDepartments
            >
          >;

          academicYears: Awaited<
            ReturnType<
              typeof listAcademicYears
            >
          >;

          programs: Awaited<
            ReturnType<
              typeof listPrograms
            >
          >;

          semesters: Awaited<
            ReturnType<
              typeof listSemesters
            >
          >;
        };

      output.departments =
        academic.departments;

      output.academicYears =
        academic.academicYears;

      output.programs =
        academic.programs;

      output.semesters =
        academic.semesters;

      continue;
    }

    if (
      key === "feeHeads" &&
      value &&
      typeof value === "object" &&
      "feeHeads" in value
    ) {
      const fees =
        value as {
          feeHeads: Awaited<
            ReturnType<
              typeof listFeeHeads
            >
          >;

          feeStructures: Awaited<
            ReturnType<
              typeof listFeeStructures
            >
          >;
        };

      output.feeHeads =
        fees.feeHeads;

      output.feeStructures =
        fees.feeStructures;

      continue;
    }

    (
      output as Record<
        string,
        unknown
      >
    )[key] = value;
  }

  return output;
}

/**
 * Load data specifically when the user opens
 * an operational tab.
 *
 * This is the key performance strategy:
 *
 * Overview:
 *   workspace only
 *
 * Timetable:
 *   offerings
 *
 * Notices:
 *   departments
 *
 * Exams:
 *   offerings + students
 *
 * Fees:
 *   students + academic + fees
 *
 * Parents:
 *   parents + students
 *
 * Notifications:
 *   notifications
 *
 * Documents:
 *   documents
 */
export async function loadErpTabData(
  tab:
    | "overview"
    | "timetable"
    | "notices"
    | "exams"
    | "fees"
    | "parents"
    | "notifications"
    | "documents",
  signal?: AbortSignal
) {
  switch (tab) {
    case "overview":
      return {};

    case "timetable":
      return loadErpSecondaryData({
        includeOfferings: true,
        signal,
      });

    case "notices":
      return loadErpSecondaryData({
        includeAcademic: true,
        signal,
      });

    case "exams":
      return loadErpSecondaryData({
        includeOfferings: true,
        includeStudents: true,
        signal,
      });

    case "fees":
      return loadErpSecondaryData({
        includeStudents: true,
        includeAcademic: true,
        includeFees: true,
        signal,
      });

    case "parents":
      return loadErpSecondaryData({
        includeParents: true,
        includeStudents: true,
        signal,
      });

    case "notifications":
      return loadErpSecondaryData({
        includeNotifications: true,
        signal,
      });

    case "documents":
      return loadErpSecondaryData({
        includeDocuments: true,
        signal,
      });

    default:
      return {};
  }
}

/**
 * Clears the client cache when the authenticated
 * tenant/session changes.
 */
export function resetErpSessionData() {
  clearErpClientCache();
}

/**
 * Merge nested grouped data returned by
 * loadErpSecondaryData.
 */
export function mergeErpData(
  current: ErpPageData,
  incoming: Partial<ErpPageData>
): ErpPageData {
  return {
    ...current,
    ...incoming,
  };
}

/**
 * Ignore AbortError generated by navigation or
 * component unmounting.
 */
export function isErpAbortError(
  error: unknown
): boolean {
  return (
    error instanceof DOMException &&
    error.name ===
      "AbortError"
  );
}

/**
 * Authentication failures should be handled by
 * the page/router rather than displayed as an
 * ordinary ERP data error.
 */
export function isErpAuthError(
  error: unknown
): boolean {
  return (
    error instanceof
    AuthRequiredError
  );
}
