import { authedFetch } from "./auth";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface ErpWorkspace {
  workspaceType: string;
  stats?: Record<string, number>;
  notices?: Array<Record<string, unknown>>;
  timetable?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  fees?: Array<Record<string, unknown>>;
  exams?: Array<Record<string, unknown>>;
  students?: Array<Record<string, unknown>>;
  facultyOfferings?: Array<Record<string, unknown>>;
  departments?: Array<Record<string, unknown>>;
}

export interface ErpUser {
  id: string;
  institutionId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive?: boolean;
  roles?: Array<{
    id: string;
    name: string;
  }>;
}

export interface ErpOffering {
  id: string;
  courseId?: string;
  semesterId?: string | null;
  sectionId?: string | null;
  facultyId?: string | null;
  isActive?: boolean;
  course?: {
    id?: string;
    code?: string;
    name?: string;
  };
  semester?: {
    id?: string;
    name?: string;
    number?: number;
  };
  section?: {
    id?: string;
    name?: string;
  } | null;
  faculty?: {
    id?: string;
    firstName?: string;
    lastName?: string;
  } | null;
}

export interface FeeHead {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
}

export interface FeeStructureItem {
  id: string;
  feeStructureId: string;
  feeHeadId: string;
  feeHeadName: string;
  feeHeadCode: string;
  amount: number;
  dueDays: number | null;
  installmentNumber: number;
}

export interface FeeStructure {
  id: string;
  name: string;
  academicYearId: string | null;
  programId: string | null;
  semesterId: string | null;
  status: string;
  currency: string;
  notes: string | null;
  totalAmount: number;
  items: FeeStructureItem[];
}

export interface ErpNotice {
  id: string;
  title: string;
  body: string;
  audience?: string;
  departmentId?: string | null;
  expiresAt?: string | null;
  publishedAt?: string | null;
}

export interface ErpNotification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ErpDocument {
  id: string;
  title: string;
  url: string;
  type: string;
  createdAt: string;
}

/*
 * ---------------------------------------------------------------------------
 * ERP CLIENT CACHE
 * ---------------------------------------------------------------------------
 *
 * The old ERP client treated every call as a completely new request.
 *
 * That became especially expensive because the ERP page calls:
 *
 *   workspace
 *   offerings
 *   students
 *   parents
 *   departments
 *   academic years
 *   programs
 *   semesters
 *   fee heads
 *   fee structures
 *   notifications
 *   documents
 *
 * together.
 *
 * This layer adds:
 *
 *   1. in-flight request deduplication
 *   2. a very short TTL cache
 *   3. targeted invalidation after mutations
 *
 * It does NOT use localStorage and does NOT persist ERP data across
 * browser sessions. Sensitive tenant data therefore remains in memory only.
 *
 * The cache is intentionally short-lived. It is a performance layer,
 * not a source of truth.
 */

const ERP_CACHE_TTL_MS = 8_000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const inFlight = new Map<
  string,
  Promise<unknown>
>();

function now() {
  return Date.now();
}

function getCached<T>(
  key: string
): T | undefined {
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return undefined;
  }

  return entry.value as T;
}

function setCached<T>(
  key: string,
  value: T
) {
  cache.set(key, {
    value,
    expiresAt:
      now() + ERP_CACHE_TTL_MS,
  });
}

async function cachedRequest<T>(
  key: string,
  request: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(key);

  if (cached !== undefined) {
    return cached;
  }

  const existing = inFlight.get(key);

  if (existing) {
    return existing as Promise<T>;
  }

  const promise = request()
    .then((value) => {
      setCached(key, value);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);

  return promise;
}

function invalidate(
  predicate: (key: string) => boolean
) {
  for (const key of cache.keys()) {
    if (predicate(key)) {
      cache.delete(key);
    }
  }
}

function invalidateWorkspace() {
  invalidate((key) =>
    key.startsWith("erp:workspace")
  );
}

function invalidateUsers(
  role?: string
) {
  invalidate((key) => {
    if (!key.startsWith("erp:users:")) {
      return false;
    }

    if (!role) {
      return true;
    }

    return key === `erp:users:${role}`;
  });
}

function invalidateFeeData() {
  invalidate(
    (key) =>
      key.startsWith("erp:fee-heads") ||
      key.startsWith("erp:fee-structures") ||
      key.startsWith("erp:workspace")
  );
}

function invalidateDocuments() {
  invalidate(
    (key) =>
      key.startsWith("erp:documents") ||
      key.startsWith("erp:workspace")
  );
}

function invalidateNotifications() {
  invalidate(
    (key) =>
      key.startsWith("erp:notifications") ||
      key.startsWith("erp:workspace")
  );
}

function invalidateOfferings() {
  invalidate(
    (key) =>
      key.startsWith("erp:offerings") ||
      key.startsWith("erp:workspace")
  );
}

/*
 * Public cache reset.
 *
 * Useful for a future global refresh button or logout handler.
 */
export function clearErpClientCache() {
  cache.clear();
  inFlight.clear();
}

/*
 * ---------------------------------------------------------------------------
 * WORKSPACE
 * ---------------------------------------------------------------------------
 */

export async function getErpWorkspace(): Promise<ErpWorkspace> {
  return cachedRequest(
    "erp:workspace",
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<ErpWorkspace>
        >(
          "/erp/me/workspace"
        );

      return response.data;
    }
  );
}

/*
 * ---------------------------------------------------------------------------
 * USERS
 * ---------------------------------------------------------------------------
 */

export async function listUsers(
  role?: string
): Promise<ErpUser[]> {
  const cacheKey =
    `erp:users:${role || "all"}`;

  return cachedRequest(
    cacheKey,
    async () => {
      const params =
        new URLSearchParams({
          page: "1",
          pageSize: "200",
        });

      if (role) {
        params.set(
          "role",
          role
        );
      }

      const response =
        await authedFetch<
          ApiEnvelope<
            | ErpUser[]
            | {
                items: ErpUser[];
              }
          >
        >(
          `/users?${params.toString()}`
        );

      if (
        Array.isArray(
          response.data
        )
      ) {
        return response.data;
      }

      return (
        response.data.items || []
      );
    }
  );
}

/*
 * ---------------------------------------------------------------------------
 * COURSE OFFERINGS
 * ---------------------------------------------------------------------------
 */

export async function listOfferings(): Promise<
  ErpOffering[]
> {
  return cachedRequest(
    "erp:offerings",
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<
            | ErpOffering[]
            | {
                items: ErpOffering[];
              }
          >
        >(
          "/course-offerings?page=1&pageSize=200"
        );

      if (
        Array.isArray(
          response.data
        )
      ) {
        return response.data;
      }

      return (
        response.data.items || []
      );
    }
  );
}

/*
 * ---------------------------------------------------------------------------
 * DEPARTMENTS
 * ---------------------------------------------------------------------------
 */

export async function listDepartments(): Promise<
  Array<{
    id: string;
    name: string;
    code?: string;
  }>
> {
  return cachedRequest(
    "erp:departments",
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<
            Array<{
              id: string;
              name: string;
              code?: string;
            }>
          >
        >(
          "/departments?page=1&pageSize=200"
        );

      return response.data;
    }
  );
}

/*
 * ---------------------------------------------------------------------------
 * ACADEMIC YEARS
 * ---------------------------------------------------------------------------
 */

export async function listAcademicYears(): Promise<
  Array<{
    id: string;
    name: string;
    isCurrent?: boolean;
  }>
> {
  return cachedRequest(
    "erp:academic-years",
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<
            Array<{
              id: string;
              name: string;
              isCurrent?: boolean;
            }>
          >
        >(
          "/academic-years?page=1&pageSize=200"
        );

      return response.data;
    }
  );
}

/*
 * ---------------------------------------------------------------------------
 * PROGRAMS
 * ---------------------------------------------------------------------------
 */

export async function listPrograms(): Promise<
  Array<{
    id: string;
    name: string;
    code?: string;
  }>
> {
  return cachedRequest(
    "erp:programs",
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<
            Array<{
              id: string;
              name: string;
              code?: string;
            }>
          >
        >(
          "/programs?page=1&pageSize=200"
        );

      return response.data;
    }
  );
}

/*
 * ---------------------------------------------------------------------------
 * SEMESTERS
 * ---------------------------------------------------------------------------
 */

export async function listSemesters(): Promise<
  Array<{
    id: string;
    name: string;
    number?: number;
  }>
> {
  return cachedRequest(
    "erp:semesters",
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<
            Array<{
              id: string;
              name: string;
              number?: number;
            }>
          >
        >(
          "/semesters?page=1&pageSize=200"
        );

      return response.data;
    }
  );
}

/*
 * ---------------------------------------------------------------------------
 * TIMETABLE
 * ---------------------------------------------------------------------------
 */

export async function createTimetableEntry(
  input: {
    courseOfferingId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<
        Record<string, unknown>
      >
    >(
      "/erp/timetable",
      {
        method: "POST",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateWorkspace();
  invalidateOfferings();

  return response.data;
}

/*
 * ---------------------------------------------------------------------------
 * NOTICES
 * ---------------------------------------------------------------------------
 */

export async function createNotice(
  input: {
    title: string;
    body: string;
    audience?: string;
    departmentId?: string;
    expiresAt?: string;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<ErpNotice>
    >(
      "/erp/notices",
      {
        method: "POST",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateWorkspace();

  return response.data;
}

/*
 * ---------------------------------------------------------------------------
 * EXAMS
 * ---------------------------------------------------------------------------
 */

export async function createExam(
  input: {
    courseOfferingId: string;
    title: string;
    examDate: string;
    maxMarks: number;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<
        Record<string, unknown>
      >
    >(
      "/erp/exams",
      {
        method: "POST",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateWorkspace();
  invalidateOfferings();

  return response.data;
}

export async function upsertExamResult(
  input: {
    examId: string;
    studentId: string;
    marks: number;
    remarks?: string;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<
        Record<string, unknown>
      >
    >(
      "/erp/exam-results",
      {
        method: "PUT",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateWorkspace();

  return response.data;
}

/*
 * ---------------------------------------------------------------------------
 * FEES
 * ---------------------------------------------------------------------------
 */

export async function createInvoice(
  input: {
    studentId: string;
    title: string;
    amount: number;
    dueDate?: string;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<
        Record<string, unknown>
      >
    >(
      "/erp/fee-invoices",
      {
        method: "POST",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateFeeData();

  return response.data;
}

export async function recordPayment(
  invoiceId: string,
  input: {
    amount: number;
    reference?: string;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<
        Record<string, unknown>
      >
    >(
      `/erp/fee-invoices/${invoiceId}/payments`,
      {
        method: "POST",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateFeeData();

  return response.data;
}

export async function createFeeHead(
  input: {
    name: string;
    code: string;
    description?: string;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<FeeHead>
    >(
      "/erp/fee-heads",
      {
        method: "POST",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateFeeData();

  return response.data;
}

export async function updateFeeHead(
  id: string,
  input: Partial<{
    name: string;
    code: string;
    description:
      | string
      | null;
    isActive: boolean;
  }>
) {
  const response =
    await authedFetch<
      ApiEnvelope<FeeHead>
    >(
      `/erp/fee-heads/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateFeeData();

  return response.data;
}

export async function listFeeHeads(
  includeInactive = false
): Promise<FeeHead[]> {
  const cacheKey =
    `erp:fee-heads:${includeInactive ? "all" : "active"}`;

  return cachedRequest(
    cacheKey,
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<FeeHead[]>
        >(
          `/erp/fee-heads?includeInactive=${
            includeInactive
              ? "true"
              : "false"
          }`
        );

      return response.data;
    }
  );
}

export async function listFeeStructures(
  params: {
    status?: string;
    academicYearId?: string;
    programId?: string;
    semesterId?: string;
  } = {}
): Promise<FeeStructure[]> {
  const qs =
    new URLSearchParams();

  Object.entries(params).forEach(
    ([key, value]) => {
      if (value) {
        qs.set(
          key,
          value
        );
      }
    }
  );

  const cacheKey =
    `erp:fee-structures:${qs.toString()}`;

  return cachedRequest(
    cacheKey,
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<FeeStructure[]>
        >(
          `/erp/fee-structures?${qs.toString()}`
        );

      return response.data;
    }
  );
}

export async function createFeeStructure(
  input: {
    name: string;
    academicYearId?: string;
    programId?: string;
    semesterId?: string;
    status?:
      | "DRAFT"
      | "ACTIVE"
      | "ARCHIVED";
    currency?: string;
    notes?: string;
    items: Array<{
      feeHeadId: string;
      amount: number;
      dueDays?: number;
      installmentNumber?: number;
    }>;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<
        FeeStructure | null
      >
    >(
      "/erp/fee-structures",
      {
        method: "POST",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateFeeData();

  return response.data;
}

export async function updateFeeStructure(
  id: string,
  input: {
    name?: string;
    status?:
      | "DRAFT"
      | "ACTIVE"
      | "ARCHIVED";
    currency?: string;
    notes?: string | null;
    items?: Array<{
      feeHeadId: string;
      amount: number;
      dueDays?: number;
      installmentNumber?: number;
    }>;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<
        FeeStructure | null
      >
    >(
      `/erp/fee-structures/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateFeeData();

  return response.data;
}

/*
 * ---------------------------------------------------------------------------
 * NOTIFICATIONS
 * ---------------------------------------------------------------------------
 */

export async function getNotifications(
  page = 1,
  limit = 50
) {
  const cacheKey =
    `erp:notifications:${page}:${limit}`;

  return cachedRequest(
    cacheKey,
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<{
            items: ErpNotification[];
            unread: number;
            pagination: Record<
              string,
              number
            >;
          }>
        >(
          `/portal/notifications?page=${page}&limit=${limit}`
        );

      return response.data;
    }
  );
}

export async function markNotificationRead(
  id: string,
  read = true
) {
  const response =
    await authedFetch<
      ApiEnvelope<ErpNotification>
    >(
      `/portal/notifications/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          read,
        }),
      }
    );

  invalidateNotifications();

  return response.data;
}

export async function markAllNotificationsRead() {
  const response =
    await authedFetch<
      ApiEnvelope<{
        updated: number;
      }>
    >(
      "/portal/notifications/read-all",
      {
        method: "POST",
      }
    );

  invalidateNotifications();

  return response.data;
}

/*
 * ---------------------------------------------------------------------------
 * DOCUMENTS
 * ---------------------------------------------------------------------------
 */

export async function getMyDocuments(): Promise<
  ErpDocument[]
> {
  return cachedRequest(
    "erp:documents:me",
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<ErpDocument[]>
        >(
          "/portal/documents/me"
        );

      return response.data;
    }
  );
}

export async function getStudentDocuments(
  studentId: string
): Promise<ErpDocument[]> {
  return cachedRequest(
    `erp:documents:student:${studentId}`,
    async () => {
      const response =
        await authedFetch<
          ApiEnvelope<ErpDocument[]>
        >(
          `/portal/documents/students/${studentId}`
        );

      return response.data;
    }
  );
}

export async function createDocument(
  input: {
    studentId: string;
    title: string;
    url: string;
    type: string;
  }
) {
  const response =
    await authedFetch<
      ApiEnvelope<ErpDocument>
    >(
      "/portal/documents",
      {
        method: "POST",
        body: JSON.stringify(
          input
        ),
      }
    );

  invalidateDocuments();

  return response.data;
}

export async function deleteDocument(
  id: string
) {
  const response =
    await authedFetch<
      ApiEnvelope<{
        deleted: boolean;
      }>
    >(
      `/portal/documents/${id}`,
      {
        method: "DELETE",
      }
    );

  invalidateDocuments();

  return response;
}
