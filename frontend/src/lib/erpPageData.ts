
"use client";

import {
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
  type ErpDocument,
  type ErpOffering,
  type ErpUser,
  type ErpWorkspace,
  type FeeHead,
  type FeeStructure,
} from "./erpApi";

export type ErpTab =
  | "overview"
  | "timetable"
  | "notices"
  | "exams"
  | "fees"
  | "parents"
  | "notifications"
  | "documents";

export interface ErpPageData {
  workspace: ErpWorkspace | null;

  offerings: ErpOffering[];

  students: ErpUser[];

  parents: ErpUser[];

  departments: Array<{
    id: string;
    name: string;
    code?: string;
  }>;

  academicYears: Array<{
    id: string;
    name: string;
    isCurrent?: boolean;
  }>;

  programs: Array<{
    id: string;
    name: string;
    code?: string;
  }>;

  semesters: Array<{
    id: string;
    name: string;
    number?: number;
  }>;

  feeHeads: FeeHead[];

  feeStructures: FeeStructure[];

  notifications: Awaited<
    ReturnType<
      typeof getNotifications
    >
  > | null;

  documents: ErpDocument[];
}

export function createEmptyErpPageData(): ErpPageData {
  return {
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
    notifications: null,
    documents: [],
  };
}

/*
 * ---------------------------------------------------------------------------
 * REQUEST CONTROL
 * ---------------------------------------------------------------------------
 *
 * Each tab gets its own AbortController.
 *
 * If the user rapidly switches:
 *
 * Fees -> Exams -> Timetable -> Fees
 *
 * an abandoned module request is cancelled instead of continuing to consume
 * browser/network resources.
 *
 * The current API functions do not yet accept AbortSignal, so the controller
 * is also used as a lifecycle marker. The next API layer can pass the signal
 * through without changing the page architecture again.
 */

const tabControllers =
  new Map<
    ErpTab,
    AbortController
  >();

export function beginTabLoad(
  tab: ErpTab
): AbortController {
  const previous =
    tabControllers.get(tab);

  previous?.abort();

  const controller =
    new AbortController();

  tabControllers.set(
    tab,
    controller
  );

  return controller;
}

export function cancelTabLoad(
  tab: ErpTab
): void {
  const controller =
    tabControllers.get(tab);

  controller?.abort();

  tabControllers.delete(tab);
}

export function cancelAllTabLoads(): void {
  for (
    const controller of tabControllers.values()
  ) {
    controller.abort();
  }

  tabControllers.clear();
}

/*
 * ---------------------------------------------------------------------------
 * DATA MERGING
 * ---------------------------------------------------------------------------
 */

export function mergeErpPageData(
  current: ErpPageData,
  patch: Partial<ErpPageData>
): ErpPageData {
  return {
    ...current,
    ...patch,
  };
}

/*
 * ---------------------------------------------------------------------------
 * CRITICAL LOAD
 * ---------------------------------------------------------------------------
 *
 * The first screen only needs the workspace.
 *
 * Nothing else is allowed to block the dashboard from becoming interactive.
 */

export async function loadErpOverview(): Promise<{
  workspace: ErpWorkspace;
}> {
  const workspace =
    await getErpWorkspace();

  return {
    workspace,
  };
}

/*
 * ---------------------------------------------------------------------------
 * TIMETABLE
 * ---------------------------------------------------------------------------
 */

export async function loadTimetableData(): Promise<
  Pick<
    ErpPageData,
    "offerings"
  >
> {
  const offerings =
    await listOfferings();

  return {
    offerings,
  };
}

/*
 * ---------------------------------------------------------------------------
 * NOTICES
 * ---------------------------------------------------------------------------
 *
 * The notices page primarily needs academic metadata for optional filtering.
 */

export async function loadNoticeData(): Promise<
  Pick<
    ErpPageData,
    | "departments"
    | "academicYears"
  >
> {
  const [
    departments,
    academicYears,
  ] = await Promise.all([
    listDepartments(),
    listAcademicYears(),
  ]);

  return {
    departments,
    academicYears,
  };
}

/*
 * ---------------------------------------------------------------------------
 * EXAMS
 * ---------------------------------------------------------------------------
 */

export async function loadExamData(): Promise<
  Pick<
    ErpPageData,
    | "offerings"
    | "students"
  >
> {
  const [
    offerings,
    students,
  ] = await Promise.all([
    listOfferings(),
    listUsers(
      "STUDENT"
    ),
  ]);

  return {
    offerings,
    students,
  };
}

/*
 * ---------------------------------------------------------------------------
 * FEES
 * ---------------------------------------------------------------------------
 */

export async function loadFeeData(): Promise<
  Pick<
    ErpPageData,
    | "students"
    | "feeHeads"
    | "feeStructures"
    | "academicYears"
    | "programs"
    | "semesters"
  >
> {
  const [
    students,
    feeHeads,
    feeStructures,
    academicYears,
    programs,
    semesters,
  ] = await Promise.all([
    listUsers(
      "STUDENT"
    ),

    listFeeHeads(),

    listFeeStructures(),

    listAcademicYears(),

    listPrograms(),

    listSemesters(),
  ]);

  return {
    students,
    feeHeads,
    feeStructures,
    academicYears,
    programs,
    semesters,
  };
}

/*
 * ---------------------------------------------------------------------------
 * PARENTS
 * ---------------------------------------------------------------------------
 */

export async function loadParentData(): Promise<
  Pick<
    ErpPageData,
    | "students"
    | "parents"
  >
> {
  const [
    students,
    parents,
  ] = await Promise.all([
    listUsers(
      "STUDENT"
    ),

    listUsers(
      "PARENT"
    ),
  ]);

  return {
    students,
    parents,
  };
}

/*
 * ---------------------------------------------------------------------------
 * NOTIFICATIONS
 * ---------------------------------------------------------------------------
 */

export async function loadNotificationData(): Promise<
  Pick<
    ErpPageData,
    "notifications"
  >
> {
  const notifications =
    await getNotifications();

  return {
    notifications,
  };
}

/*
 * ---------------------------------------------------------------------------
 * DOCUMENTS
 * ---------------------------------------------------------------------------
 */

export async function loadDocumentData(): Promise<
  Pick<
    ErpPageData,
    "documents"
  >
> {
  const documents =
    await getMyDocuments();

  return {
    documents,
  };
}

/*
 * ---------------------------------------------------------------------------
 * TAB LOADER
 * ---------------------------------------------------------------------------
 *
 * This is intentionally explicit.
 *
 * It prevents accidental "load everything" behavior from creeping back
 * into the ERP page.
 */

export async function loadErpTab(
  tab: ErpTab
): Promise<
  Partial<ErpPageData>
> {
  switch (tab) {
    case "overview":
      return loadErpOverview();

    case "timetable":
      return loadTimetableData();

    case "notices":
      return loadNoticeData();

    case "exams":
      return loadExamData();

    case "fees":
      return loadFeeData();

    case "parents":
      return loadParentData();

    case "notifications":
      return loadNotificationData();

    case "documents":
      return loadDocumentData();

    default:
      return {};
  }
}

/*
 * ---------------------------------------------------------------------------
 * PRELOAD STRATEGY
 * ---------------------------------------------------------------------------
 *
 * We only preload the next likely module.
 *
 * We DO NOT preload every ERP module.
 */

export function getPreloadTab(
  current: ErpTab
): ErpTab | null {
  switch (current) {
    case "overview":
      return "timetable";

    case "timetable":
      return "notices";

    case "notices":
      return "exams";

    case "exams":
      return "fees";

    case "fees":
      return "parents";

    case "parents":
      return "notifications";

    case "notifications":
      return "documents";

    case "documents":
      return null;

    default:
      return null;
  }
}

/*
 * ---------------------------------------------------------------------------
 * ERROR HELPERS
 * ---------------------------------------------------------------------------
 */

export function isAbortError(
  error: unknown
): boolean {
  return (
    error instanceof
      DOMException &&
    error.name ===
      "AbortError"
  );
}

export function getErpErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error ===
    "string"
  ) {
    return error;
  }

  return "Unable to load this ERP module.";
}
