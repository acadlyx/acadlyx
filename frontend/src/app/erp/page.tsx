"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
AuthRequiredError,
getCurrentUser,
} from "@/lib/auth";
import {
ErpDocument,
ErpOffering,
ErpWorkspace,
ErpUser,
FeeHead,
FeeStructure,
createDocument,
createExam,
createFeeHead,
createFeeStructure,
createInvoice,
createNotice,
createParentLink,
createTimetableEntry,
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
markAllNotificationsRead,
markNotificationRead,
recordPayment,
updateFeeHead,
upsertExamResult,
} from "@/lib/erpApi";

type Tab =
| "overview"
| "timetable"
| "notices"
| "exams"
| "fees"
| "parents"
| "notifications"
| "documents";

function isTab(value: string | null): value is Tab {
return [
"overview",
"timetable",
"notices",
"exams",
"fees",
"parents",
"notifications",
"documents",
].includes(value || "");
}

const tabs: Array<{
id: Tab;
label: string;
description: string;
}> = [
{
id: "overview",
label: "Overview",
description:
"ERP operations and institutional health",
},
{
id: "timetable",
label: "Timetable",
description:
"Schedule courses and detect conflicts",
},
{
id: "notices",
label: "Notices",
description:
"Publish institution communications",
},
{
id: "exams",
label: "Exams & Results",
description:
"Create examinations and enter results",
},
{
id: "fees",
label: "Fees",
description:
"Fee heads, structures, invoices and payments",
},
{
id: "parents",
label: "Parent Links",
description:
"Connect parents with students",
},
{
id: "notifications",
label: "Notifications",
description:
"Read and manage portal notifications",
},
{
id: "documents",
label: "Documents",
description:
"Manage student portal documents",
},
];

const inputClass =
"w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus focus focus";

const labelClass =
"mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

function Field({
label,
children,
}: {
label: string;
children: React.ReactNode;
}) {
return (
<label className="block">
<span className={labelClass}>
{label}
</span>
{children}
</label>
);
}

function Section({
title,
description,
children,
}: {
title: string;
description?: string;
children: React.ReactNode;
}) {
return (
<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
<div className="mb-5">
<h2 className="text-base font-bold text-slate-950">
{title}
</h2>

    {description && (
      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    )}
  </div>

  {children}
</section>

);
}

function Submit({
busy,
children = "Save",
}: {
busy: boolean;
children?: React.ReactNode;
}) {
return (
<button disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" >
{busy ? "Saving…" : children}
</button>
);
}

function money(
value: number | string | null | undefined,
currency = "INR"
) {
return new Intl.NumberFormat("en-IN", {
style: "currency",
currency,
maximumFractionDigits: 2,
}).format(Number(value || 0));
}

function dateValue(
value?: string | null
) {
if (!value) {
return "—";
}

const date = new Date(value);

if (Number.isNaN(date.getTime())) {
return value;
}

return date.toLocaleString(
"en-IN",
{
dateStyle: "medium",
timeStyle: "short",
}
);
}

function ERPPageContent() {
const router = useRouter();
const searchParams = useSearchParams();
const requestedTab = searchParams.get("tab");

const [tab, setTab] =
useState<Tab>(() => isTab(requestedTab) ? requestedTab : "overview");

useEffect(() => {
if (isTab(requestedTab)) {
setTab(requestedTab);
}
}, [requestedTab]);

const [loading, setLoading] =
useState(true);

const [busy, setBusy] =
useState(false);

const [error, setError] =
useState("");

const [success, setSuccess] =
useState("");

const [roles, setRoles] =
useState<string[]>([]);

const [workspace, setWorkspace] =
useState<ErpWorkspace | null>(
null
);

const [offerings, setOfferings] =
useState<ErpOffering[]>([]);

const [students, setStudents] =
useState<ErpUser[]>([]);

const [parents, setParents] =
useState<ErpUser[]>([]);

const [departments, setDepartments] =
useState<
Array<{
id: string;
name: string;
code?: string;
}>
>([]);

const [academicYears, setAcademicYears] =
useState<
Array<{
id: string;
name: string;
isCurrent?: boolean;
}>
>([]);

const [programs, setPrograms] =
useState<
Array<{
id: string;
name: string;
code?: string;
}>
>([]);

const [semesters, setSemesters] =
useState<
Array<{
id: string;
name: string;
number?: number;
}>
>([]);

const [feeHeads, setFeeHeads] =
useState<FeeHead[]>([]);

const [feeStructures, setFeeStructures] =
useState<FeeStructure[]>([]);

const [notifications, setNotifications] =
useState<{
items: Array<{
id: string;
title: string;
body: string;
readAt: string | null;
createdAt: string;
}>;
unread: number;
}>({
items: [],
unread: 0,
});

const [documents, setDocuments] =
useState<ErpDocument[]>([]);

const can = (
permissionRoles: string[]
) =>
roles.some((role) =>
permissionRoles.includes(role)
);

async function loadAll() {
setLoading(true);
setError("");

try {
  const user =
    await getCurrentUser();

  setRoles(user.roles);

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

  // The shell needs only its aggregate workspace data.  Module datasets are
  // deliberately fetched only for the active tab so opening ERP does not
  // create a twelve-request storm or preload records the user will not view.
  const [workspaceResult, notificationsResult] = await Promise.allSettled([
    getErpWorkspace(),
    getNotifications(),
  ]);

  if (
    workspaceResult.status ===
    "fulfilled"
  ) {
    setWorkspace(workspaceResult.value);
  }

  if (
    notificationsResult.status ===
    "fulfilled"
  ) {
    setNotifications(
      notificationsResult.value
    );
  }

  if (workspaceResult.status === "rejected" && notificationsResult.status === "rejected") throw workspaceResult.reason;

  if (tab === "overview") {
    const [offeringsResult, feeStructuresResult, documentsResult] = await Promise.allSettled([listOfferings(), listFeeStructures(), getMyDocuments()]);
    if (offeringsResult.status === "fulfilled") setOfferings(offeringsResult.value);
    if (feeStructuresResult.status === "fulfilled") setFeeStructures(feeStructuresResult.value);
    if (documentsResult.status === "fulfilled") setDocuments(documentsResult.value);
  } else if (tab === "timetable" || tab === "exams") {
    const [offeringsResult, studentsResult] = await Promise.allSettled(tab === "exams" ? [listOfferings(), listUsers("STUDENT")] : [listOfferings()]);
    if (offeringsResult.status === "fulfilled") setOfferings(offeringsResult.value);
    if (studentsResult?.status === "fulfilled") setStudents(studentsResult.value);
  } else if (tab === "notices") {
    const [departmentsResult] = await Promise.allSettled([listDepartments()]);
    if (departmentsResult.status === "fulfilled") setDepartments(departmentsResult.value);
  } else if (tab === "fees") {
    const [studentsResult, academicYearsResult, programsResult, semestersResult, feeHeadsResult, feeStructuresResult] = await Promise.allSettled([listUsers("STUDENT"), listAcademicYears(), listPrograms(), listSemesters(), listFeeHeads(), listFeeStructures()]);
    if (studentsResult.status === "fulfilled") setStudents(studentsResult.value);
    if (academicYearsResult.status === "fulfilled") setAcademicYears(academicYearsResult.value);
    if (programsResult.status === "fulfilled") setPrograms(programsResult.value);
    if (semestersResult.status === "fulfilled") setSemesters(semestersResult.value);
    if (feeHeadsResult.status === "fulfilled") setFeeHeads(feeHeadsResult.value);
    if (feeStructuresResult.status === "fulfilled") setFeeStructures(feeStructuresResult.value);
  } else if (tab === "parents") {
    const [parentsResult, studentsResult] = await Promise.allSettled([listUsers("PARENT"), listUsers("STUDENT")]);
    if (parentsResult.status === "fulfilled") setParents(parentsResult.value);
    if (studentsResult.status === "fulfilled") setStudents(studentsResult.value);
  } else if (tab === "documents") {
    const [studentsResult, documentsResult] = await Promise.allSettled([listUsers("STUDENT"), getMyDocuments()]);
    if (studentsResult.status === "fulfilled") setStudents(studentsResult.value);
    if (documentsResult.status === "fulfilled") setDocuments(documentsResult.value);
  }
} catch (err) {
  if (
    err instanceof AuthRequiredError
  ) {
    router.replace("/login");
    return;
  }

  setError(
    err instanceof Error
      ? err.message
      : "Unable to load ERP workspace."
  );
} finally {
  setLoading(false);
}

}

useEffect(() => { void loadAll(); }, [tab]);

function flash(message: string) {
setSuccess(message);

window.setTimeout(
  () => setSuccess(""),
  3500
);

}

async function run(
action: () => Promise<unknown>,
message: string
) {
setBusy(true);
setError("");

try {
  await action();
  flash(message);
  await loadAll();
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : "Operation failed."
  );
} finally {
  setBusy(false);
}

}

const stats = useMemo(
() =>
(workspace?.stats || {}) as Record<
string,
number
>,
[workspace]
);

return (
<DashboardShell
title="ERP Operations"
subtitle="Academic, finance and student services"
allowedRoles={[
"SUPER_ADMIN",
"INSTITUTION_ADMIN",
"DIRECTOR",
"MANAGEMENT",
"HOD",
"STAFF",
"FACULTY",
"PARENT",
"STUDENT",
]}
>
<div className="space-y-6">
<div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
<div>
<p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
ACADLYX ERP
</p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          Operations Center
        </h1>

        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          One production workspace for
          the operational modules already
          protected by the backend.
        </p>
      </div>

      <button
        onClick={() => void loadAll()}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
      >
        Refresh data
      </button>
    </div>

    {error && (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )}

    {success && (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        {success}
      </div>
    )}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        "users",
        "students",
        "faculty",
        "departments",
        "programs",
        "courses",
        "exams",
        "totalInvoices",
      ].map((key) => (
        <div
          key={key}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {key.replace(
              /([A-Z])/g,
              " $1"
            )}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-950">
            {loading
              ? "…"
              : stats[key] ?? 0}
          </p>
        </div>
      ))}
    </div>

    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
      {tabs.map((item) => (
        <button
          key={item.id}
          onClick={() =>
            setTab(item.id)
          }
          className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${
            tab === item.id
              ? "bg-slate-950 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>

    {tab === "overview" && (
      <Overview
        workspace={workspace}
        offerings={offerings}
        notifications={notifications}
        feeStructures={
          feeStructures
        }
        documents={documents}
      />
    )}

    {tab === "timetable" && (
      <TimetableTab
        offerings={offerings}
        canManage={can([
          "INSTITUTION_ADMIN",
          "HOD",
          "STAFF",
        ])}
        busy={busy}
        run={run}
      />
    )}

    {tab === "notices" && (
      <NoticeTab
        departments={departments}
        canManage={can([
          "INSTITUTION_ADMIN",
          "DIRECTOR",
          "MANAGEMENT",
          "HOD",
          "STAFF",
        ])}
        busy={busy}
        run={run}
      />
    )}

    {tab === "exams" && (
      <ExamTab
        offerings={offerings}
        students={students}
        canManage={can([
          "INSTITUTION_ADMIN",
          "HOD",
          "FACULTY",
        ])}
        busy={busy}
        run={run}
      />
    )}

    {tab === "fees" && (
      <FeesTab
        students={students}
        academicYears={
          academicYears
        }
        programs={programs}
        semesters={semesters}
        feeHeads={feeHeads}
        feeStructures={
          feeStructures
        }
        canManage={can([
          "INSTITUTION_ADMIN",
          "STAFF",
          "SUPER_ADMIN",
        ])}
        busy={busy}
        run={run}
      />
    )}

    {tab === "parents" && (
      <ParentTab
        parents={parents}
        students={students}
        canManage={can([
          "INSTITUTION_ADMIN",
          "STAFF",
          "SUPER_ADMIN",
        ])}
        busy={busy}
        run={run}
      />
    )}

    {tab === "notifications" && (
      <NotificationsTab
        notifications={
          notifications
        }
        busy={busy}
        onRefresh={loadAll}
        onRead={(id) =>
          run(
            () =>
              markNotificationRead(
                id,
                true
              ),
            "Notification marked as read"
          )
        }
        onReadAll={() =>
          run(
            markAllNotificationsRead,
            "All notifications marked as read"
          )
        }
      />
    )}

    {tab === "documents" && (
      <DocumentsTab
        students={students}
        documents={documents}
        canManage={can([
          "INSTITUTION_ADMIN",
          "STAFF",
          "SUPER_ADMIN",
        ])}
        busy={busy}
        run={run}
        onRefresh={loadAll}
      />
    )}
  </div>
</DashboardShell>

);
}

export default function ERPPage() {
return (
<Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
<ERPPageContent />
</Suspense>
);
}

function Overview({
workspace,
offerings,
notifications,
feeStructures,
documents,
}: {
workspace: ErpWorkspace | null;
offerings: ErpOffering[];
notifications: {
unread: number;
};
feeStructures: FeeStructure[];
documents: ErpDocument[];
}) {
const notices = Array.isArray(
workspace?.notices
)
? (workspace.notices as Array<
Record<string, unknown>
>)
: [];

return (
<div className="grid gap-6 xl:grid-cols-2">
<Section title="Operational coverage" description="The live backend workspace available to the current role." >
<div className="grid gap-3 sm:grid-cols-2">
{[
[
"Course offerings",
offerings.length,
],
[
"Fee structures",
feeStructures.length,
],
[
"Unread notifications",
notifications.unread,
],
[
"Documents",
documents.length,
],
].map(
([label, value]) => (
<div key={String(label)} className="rounded-xl bg-slate-50 p-4" >
<p className="text-xs font-semibold text-slate-500">
{label}
</p>

            <p className="mt-1 text-xl font-bold">
              {value}
            </p>
          </div>
        )
      )}
    </div>
  </Section>

  <Section
    title="Recent notices"
    description="Published notices returned by the role-scoped ERP workspace."
  >
    {notices.length === 0 ? (
      <Empty text="No notices available for this role." />
    ) : (
      <div className="space-y-3">
        {notices.map(
          (notice) => (
            <div
              key={String(
                notice.id
              )}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold">
                  {String(
                    notice.title ||
                      "Notice"
                  )}
                </h3>

                <span className="text-xs text-slate-400">
                  {dateValue(
                    String(
                      notice.publishedAt ||
                        notice.createdAt ||
                        ""
                    )
                  )}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {String(
                  notice.body || ""
                )}
              </p>
            </div>
          )
        )}
      </div>
    )}
  </Section>
</div>

);
}

function TimetableTab({
offerings,
canManage,
busy,
run,
}: {
offerings: ErpOffering[];
canManage: boolean;
busy: boolean;
run: (
action: () => Promise<unknown>,
message: string
) => Promise<void>;
}) {
const [form, setForm] =
useState({
courseOfferingId: "",
dayOfWeek: "1",
startTime: "09:00",
endTime: "10:00",
room: "",
});

if (!canManage) {
return <AccessDenied />;
}

return (
<Section title="Create / update timetable entry" description="The backend rejects section, faculty and room conflicts before saving." >
<form
className="grid gap-4 md"
onSubmit={(event) => {
event.preventDefault();

      void run(
        () =>
          createTimetableEntry(
            {
              courseOfferingId:
                form.courseOfferingId,
              dayOfWeek:
                Number(
                  form.dayOfWeek
                ),
              startTime:
                form.startTime,
              endTime:
                form.endTime,
              room:
                form.room ||
                undefined,
            }
          ),
        "Timetable entry saved"
      );
    }}
  >
    <Field label="Course offering">
      <select
        required
        value={
          form.courseOfferingId
        }
        onChange={(event) =>
          setForm({
            ...form,
            courseOfferingId:
              event.target.value,
          })
        }
        className={inputClass}
      >
        <option value="">
          Select offering
        </option>

        {offerings.map(
          (offering) => (
            <option
              key={offering.id}
              value={offering.id}
            >
              {offering.course?.code}{" "}
              —{" "}
              {offering.course?.name}{" "}
              {offering.section?.name
                ? `· ${offering.section.name}`
                : ""}
            </option>
          )
        )}
      </select>
    </Field>

    <Field label="Day">
      <select
        value={form.dayOfWeek}
        onChange={(event) =>
          setForm({
            ...form,
            dayOfWeek:
              event.target.value,
          })
        }
        className={inputClass}
      >
        {[
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ].map(
          (day, index) => (
            <option
              key={day}
              value={index}
            >
              {day}
            </option>
          )
        )}
      </select>
    </Field>

    <Field label="Start time">
      <input
        required
        type="time"
        value={form.startTime}
        onChange={(event) =>
          setForm({
            ...form,
            startTime:
              event.target.value,
          })
        }
        className={inputClass}
      />
    </Field>

    <Field label="End time">
      <input
        required
        type="time"
        value={form.endTime}
        onChange={(event) =>
          setForm({
            ...form,
            endTime:
              event.target.value,
          })
        }
        className={inputClass}
      />
    </Field>

    <Field label="Room">
      <input
        value={form.room}
        onChange={(event) =>
          setForm({
            ...form,
            room: event.target.value,
          })
        }
        placeholder="Room / Lab"
        className={inputClass}
      />
    </Field>

    <div className="flex items-end">
      <Submit busy={busy}>
        Save timetable
      </Submit>
    </div>
  </form>
</Section>

);
}

function NoticeTab({
departments,
canManage,
busy,
run,
}: {
departments: Array<{
id: string;
name: string;
}>;
canManage: boolean;
busy: boolean;
run: (
action: () => Promise<unknown>,
message: string
) => Promise<void>;
}) {
const [form, setForm] =
useState({
title: "",
body: "",
audience: "ALL",
departmentId: "",
expiresAt: "",
});

if (!canManage) {
return <AccessDenied />;
}

return (
<Section title="Publish notice" description="Notices are tenant-scoped and can optionally be restricted to an audience or department." >
<form
className="space-y-4"
onSubmit={(event) => {
event.preventDefault();

      void run(
        () =>
          createNotice({
            title: form.title,
            body: form.body,
            audience:
              form.audience,
            departmentId:
              form.departmentId ||
              undefined,
            expiresAt:
              form.expiresAt ||
              undefined,
          }),
        "Notice published"
      );
    }}
  >
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Title">
        <input
          required
          maxLength={200}
          value={form.title}
          onChange={(event) =>
            setForm({
              ...form,
              title:
                event.target.value,
            })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Audience">
        <select
          value={form.audience}
          onChange={(event) =>
            setForm({
              ...form,
              audience:
                event.target.value,
            })
          }
          className={inputClass}
        >
          {[
            "ALL",
            "STUDENT",
            "FACULTY",
            "PARENT",
            "STAFF",
            "HOD",
            "MANAGEMENT",
          ].map(
            (audience) => (
              <option
                key={audience}
              >
                {audience}
              </option>
            )
          )}
        </select>
      </Field>

      <Field label="Department (optional)">
        <select
          value={
            form.departmentId
          }
          onChange={(event) =>
            setForm({
              ...form,
              departmentId:
                event.target.value,
            })
          }
          className={inputClass}
        >
          <option value="">
            All departments
          </option>

          {departments.map(
            (department) => (
              <option
                key={department.id}
                value={
                  department.id
                }
              >
                {department.name}
              </option>
            )
          )}
        </select>
      </Field>

      <Field label="Expires at (optional)">
        <input
          type="datetime-local"
          value={form.expiresAt}
          onChange={(event) =>
            setForm({
              ...form,
              expiresAt:
                event.target.value,
            })
          }
          className={inputClass}
        />
      </Field>
    </div>

    <Field label="Message">
      <textarea
        required
        maxLength={10000}
        rows={8}
        value={form.body}
        onChange={(event) =>
          setForm({
            ...form,
            body: event.target.value,
          })
        }
        className={inputClass}
      />
    </Field>

    <Submit busy={busy}>
      Publish notice
    </Submit>
  </form>
</Section>

);
}

function ExamTab({
offerings,
students,
canManage,
busy,
run,
}: {
offerings: ErpOffering[];
students: ErpUser[];
canManage: boolean;
busy: boolean;
run: (
action: () => Promise<unknown>,
message: string
) => Promise<void>;
}) {
const [exam, setExam] =
useState({
courseOfferingId: "",
title: "",
examDate: "",
maxMarks: "100",
});

const [result, setResult] =
useState({
examId: "",
studentId: "",
marks: "",
remarks: "",
});

if (!canManage) {
return <AccessDenied />;
}

return (
<div className="grid gap-6 xl:grid-cols-2">
<Section title="Create exam">
<form
className="space-y-4"
onSubmit={(event) => {
event.preventDefault();

        void run(
          () =>
            createExam({
              courseOfferingId:
                exam.courseOfferingId,
              title: exam.title,
              examDate:
                new Date(
                  exam.examDate
                ).toISOString(),
              maxMarks:
                Number(
                  exam.maxMarks
                ),
            }),
          "Exam created"
        );
      }}
    >
      <Field label="Course offering">
        <select
          required
          value={
            exam.courseOfferingId
          }
          onChange={(event) =>
            setExam({
              ...exam,
              courseOfferingId:
                event.target.value,
            })
          }
          className={inputClass}
        >
          <option value="">
            Select offering
          </option>

          {offerings.map(
            (offering) => (
              <option
                key={offering.id}
                value={offering.id}
              >
                {offering.course?.code}{" "}
                —{" "}
                {offering.course?.name}{" "}
                {offering.section?.name
                  ? `· ${offering.section.name}`
                  : ""}
              </option>
            )
          )}
        </select>
      </Field>

      <Field label="Exam title">
        <input
          required
          value={exam.title}
          onChange={(event) =>
            setExam({
              ...exam,
              title:
                event.target.value,
            })
          }
          placeholder="Mid Semester Examination"
          className={inputClass}
        />
      </Field>

      <Field label="Exam date">
        <input
          required
          type="datetime-local"
          value={exam.examDate}
          onChange={(event) =>
            setExam({
              ...exam,
              examDate:
                event.target.value,
            })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Maximum marks">
        <input
          required
          type="number"
          min="1"
          value={exam.maxMarks}
          onChange={(event) =>
            setExam({
              ...exam,
              maxMarks:
                event.target.value,
            })
          }
          className={inputClass}
        />
      </Field>

      <Submit busy={busy}>
        Create exam
      </Submit>
    </form>
  </Section>

  <Section
    title="Enter / correct result"
    description="The backend validates section enrollment and maximum marks."
  >
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();

        void run(
          () =>
            upsertExamResult({
              examId:
                result.examId,
              studentId:
                result.studentId,
              marks: Number(
                result.marks
              ),
              remarks:
                result.remarks ||
                undefined,
            }),
          "Exam result saved"
        );
      }}
    >
      <Field label="Exam ID">
        <input
          required
          value={result.examId}
          onChange={(event) =>
            setResult({
              ...result,
              examId:
                event.target.value,
            })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Student">
        <select
          required
          value={
            result.studentId
          }
          onChange={(event) =>
            setResult({
              ...result,
              studentId:
                event.target.value,
            })
          }
          className={inputClass}
        >
          <option value="">
            Select student
          </option>

          {students.map(
            (student) => (
              <option
                key={student.id}
                value={student.id}
              >
                {student.firstName}{" "}
                {student.lastName}{" "}
                —{" "}
                {student.email}
              </option>
            )
          )}
        </select>
      </Field>

      <Field label="Marks">
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={result.marks}
          onChange={(event) =>
            setResult({
              ...result,
              marks:
                event.target.value,
            })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Remarks">
        <textarea
          rows={4}
          value={
            result.remarks
          }
          onChange={(event) =>
            setResult({
              ...result,
              remarks:
                event.target.value,
            })
          }
          className={inputClass}
        />
      </Field>

      <Submit busy={busy}>
        Save result
      </Submit>
    </form>
  </Section>
</div>

);
}

function FeesTab({
students,
academicYears,
programs,
semesters,
feeHeads,
feeStructures,
canManage,
busy,
run,
}: {
students: ErpUser[];
academicYears: Array<{
id: string;
name: string;
isCurrent?: boolean;
}>;
programs: Array<{
id: string;
name: string;
}>;
semesters: Array<{
id: string;
name: string;
}>;
feeHeads: FeeHead[];
feeStructures: FeeStructure[];
canManage: boolean;
busy: boolean;
run: (
action: () => Promise<unknown>,
message: string
) => Promise<void>;
}) {
const [head, setHead] =
useState({
name: "",
code: "",
description: "",
});

const [structure, setStructure] =
useState({
name: "",
academicYearId: "",
programId: "",
semesterId: "",
status:
"DRAFT" as
| "DRAFT"
| "ACTIVE"
| "ARCHIVED",
currency: "INR",
notes: "",
feeHeadId: "",
amount: "",
dueDays: "",
installmentNumber: "1",
});

const [invoice, setInvoice] =
useState({
studentId: "",
title: "",
amount: "",
dueDate: "",
});

const [payment, setPayment] =
useState({
invoiceId: "",
amount: "",
reference: "",
});

useEffect(() => {
if (
!structure.academicYearId
) {
const current =
academicYears.find(
(year) =>
year.isCurrent
);

  if (current) {
    setStructure(
      (value) => ({
        ...value,
        academicYearId:
          current.id,
      })
    );
  }
}

}, [
academicYears,
structure.academicYearId,
]);

if (!canManage) {
return <AccessDenied />;
}

return (
<div className="space-y-6">
<div className="grid gap-6 xl:grid-cols-2">
<Section title="Fee heads">
<form
className="space-y-4"
onSubmit={(event) => {
event.preventDefault();

          void run(
            () =>
              createFeeHead({
                name: head.name,
                code: head.code,
                description:
                  head.description ||
                  undefined,
              }),
            "Fee head created"
          );
        }}
      >
        <Field label="Name">
          <input
            required
            value={head.name}
            onChange={(event) =>
              setHead({
                ...head,
                name: event.target
                  .value,
              })
            }
            className={inputClass}
          />
        </Field>

        <Field label="Code">
          <input
            required
            value={head.code}
            onChange={(event) =>
              setHead({
                ...head,
                code: event.target
                  .value
                  .toUpperCase(),
              })
            }
            className={inputClass}
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            value={
              head.description
            }
            onChange={(event) =>
              setHead({
                ...head,
                description:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </Field>

        <Submit busy={busy}>
          Create fee head
        </Submit>
      </form>

      <div className="mt-6 space-y-2">
        {feeHeads.map(
          (feeHead) => (
            <div
              key={feeHead.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
            >
              <div>
                <p className="font-semibold">
                  {feeHead.name}
                </p>

                <p className="text-xs text-slate-500">
                  {feeHead.code}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void run(
                    () =>
                      updateFeeHead(
                        feeHead.id,
                        {
                          isActive:
                            feeHead.isActive ===
                            false,
                        }
                      ),
                    feeHead.isActive ===
                      false
                      ? "Fee head activated"
                      : "Fee head deactivated"
                  )
                }
                className="text-xs font-semibold text-slate-600"
              >
                {feeHead.isActive ===
                false
                  ? "Activate"
                  : "Deactivate"}
              </button>
            </div>
          )
        )}
      </div>
    </Section>

    <Section
      title="Create fee structure"
      description="Create the first fee-head item for a structure. Additional installments can be added through later editing."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();

          void run(
            () =>
              createFeeStructure(
                {
                  name:
                    structure.name,
                  academicYearId:
                    structure.academicYearId ||
                    undefined,
                  programId:
                    structure.programId ||
                    undefined,
                  semesterId:
                    structure.semesterId ||
                    undefined,
                  status:
                    structure.status,
                  currency:
                    structure.currency,
                  notes:
                    structure.notes ||
                    undefined,
                  items: [
                    {
                      feeHeadId:
                        structure.feeHeadId,
                      amount: Number(
                        structure.amount
                      ),
                      dueDays:
                        structure.dueDays
                          ? Number(
                              structure.dueDays
                            )
                          : undefined,
                      installmentNumber:
                        Number(
                          structure.installmentNumber
                        ),
                    },
                  ],
                }
              ),
            "Fee structure created"
          );
        }}
      >
        <Field label="Name">
          <input
            required
            value={
              structure.name
            }
            onChange={(event) =>
              setStructure({
                ...structure,
                name: event.target
                  .value,
              })
            }
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Academic year">
            <select
              value={
                structure.academicYearId
              }
              onChange={(event) =>
                setStructure({
                  ...structure,
                  academicYearId:
                    event.target
                      .value,
                })
              }
              className={inputClass}
            >
              <option value="">
                Any year
              </option>

              {academicYears.map(
                (year) => (
                  <option
                    key={year.id}
                    value={year.id}
                  >
                    {year.name}
                    {year.isCurrent
                      ? " · Current"
                      : ""}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="Program">
            <select
              value={
                structure.programId
              }
              onChange={(event) =>
                setStructure({
                  ...structure,
                  programId:
                    event.target
                      .value,
                })
              }
              className={inputClass}
            >
              <option value="">
                Any program
              </option>

              {programs.map(
                (program) => (
                  <option
                    key={program.id}
                    value={
                      program.id
                    }
                  >
                    {program.name}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="Semester">
            <select
              value={
                structure.semesterId
              }
              onChange={(event) =>
                setStructure({
                  ...structure,
                  semesterId:
                    event.target
                      .value,
                })
              }
              className={inputClass}
            >
              <option value="">
                Any semester
              </option>

              {semesters.map(
                (semester) => (
                  <option
                    key={semester.id}
                    value={
                      semester.id
                    }
                  >
                    {semester.name}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="Status">
            <select
              value={
                structure.status
              }
              onChange={(event) =>
                setStructure({
                  ...structure,
                  status:
                    event.target
                      .value as typeof structure.status,
                })
              }
              className={inputClass}
            >
              <option>
                DRAFT
              </option>
              <option>
                ACTIVE
              </option>
              <option>
                ARCHIVED
              </option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fee head">
            <select
              required
              value={
                structure.feeHeadId
              }
              onChange={(event) =>
                setStructure({
                  ...structure,
                  feeHeadId:
                    event.target
                      .value,
                })
              }
              className={inputClass}
            >
              <option value="">
                Select head
              </option>

              {feeHeads
                .filter(
                  (item) =>
                    item.isActive !==
                    false
                )
                .map(
                  (item) => (
                    <option
                      key={item.id}
                      value={
                        item.id
                      }
                    >
                      {item.name} (
                      {
                        item.code
                      }
                      )
                    </option>
                  )
                )}
            </select>
          </Field>

          <Field label="Amount">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={
                structure.amount
              }
              onChange={(event) =>
                setStructure({
                  ...structure,
                  amount:
                    event.target
                      .value,
                })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Due after days">
            <input
              type="number"
              min="0"
              value={
                structure.dueDays
              }
              onChange={(event) =>
                setStructure({
                  ...structure,
                  dueDays:
                    event.target
                      .value,
                })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Installment">
            <input
              required
              type="number"
              min="1"
              value={
                structure.installmentNumber
              }
              onChange={(event) =>
                setStructure({
                  ...structure,
                  installmentNumber:
                    event.target
                      .value,
                })
              }
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            rows={3}
            value={
              structure.notes
            }
            onChange={(event) =>
              setStructure({
                ...structure,
                notes:
                  event.target.value,
              })
            }
            className={inputClass}
          />
        </Field>

        <Submit busy={busy}>
          Create structure
        </Submit>
      </form>
    </Section>
  </div>

  <div className="grid gap-6 xl:grid-cols-2">
    <Section title="Fee structures">
      {feeStructures.length ===
      0 ? (
        <Empty text="No fee structures found." />
      ) : (
        <div className="space-y-3">
          {feeStructures.map(
            (structure) => (
              <div
                key={
                  structure.id
                }
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {
                        structure.name
                      }
                    </p>

                    <p className="text-xs text-slate-500">
                      {
                        structure.status
                      }{" "}
                      ·{" "}
                      {
                        structure.currency
                      }
                    </p>
                  </div>

                  <p className="font-bold">
                    {money(
                      structure.totalAmount,
                      structure.currency
                    )}
                  </p>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  {structure.items.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        className="flex justify-between"
                      >
                        <span>
                          {
                            item.feeHeadName
                          }{" "}
                          · Installment{" "}
                          {
                            item.installmentNumber
                          }
                        </span>

                        <span>
                          {money(
                            item.amount,
                            structure.currency
                          )}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </Section>

    <Section title="Invoice & payment">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();

          void run(
            () =>
              createInvoice({
                studentId:
                  invoice.studentId,
                title:
                  invoice.title,
                amount: Number(
                  invoice.amount
                ),
                dueDate:
                  invoice.dueDate ||
                  undefined,
              }),
            "Invoice created"
          );
        }}
      >
        <Field label="Student">
          <select
            required
            value={
              invoice.studentId
            }
            onChange={(event) =>
              setInvoice({
                ...invoice,
                studentId:
                  event.target
                    .value,
              })
            }
            className={inputClass}
          >
            <option value="">
              Select student
            </option>

            {students.map(
              (student) => (
                <option
                  key={
                    student.id
                  }
                  value={
                    student.id
                  }
                >
                  {
                    student.firstName
                  }{" "}
                  {
                    student.lastName
                  }{" "}
                  —{" "}
                  {
                    student.email
                  }
                </option>
              )
            )}
          </select>
        </Field>

        <Field label="Invoice title">
          <input
            required
            value={
              invoice.title
            }
            onChange={(event) =>
              setInvoice({
                ...invoice,
                title:
                  event.target
                    .value,
              })
            }
            className={inputClass}
          />
        </Field>

        <Field label="Amount">
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={
              invoice.amount
            }
            onChange={(event) =>
              setInvoice({
                ...invoice,
                amount:
                  event.target
                    .value,
              })
            }
            className={inputClass}
          />
        </Field>

        <Field label="Due date">
          <input
            type="date"
            value={
              invoice.dueDate
            }
            onChange={(event) =>
              setInvoice({
                ...invoice,
                dueDate:
                  event.target
                    .value,
              })
            }
            className={inputClass}
          />
        </Field>

        <Submit busy={busy}>
          Create invoice
        </Submit>
      </form>

      <div className="my-6 border-t border-slate-200" />

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();

          void run(
            () =>
              recordPayment(
                payment.invoiceId,
                {
                  amount: Number(
                    payment.amount
                  ),
                  reference:
                    payment.reference ||
                    undefined,
                }
              ),
            "Payment recorded"
          );
        }}
      >
        <Field label="Invoice ID">
          <input
            required
            value={
              payment.invoiceId
            }
            onChange={(event) =>
              setPayment({
                ...payment,
                invoiceId:
                  event.target
                    .value,
              })
            }
            className={inputClass}
          />
        </Field>

        <Field label="Payment amount">
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={
              payment.amount
            }
            onChange={(event) =>
              setPayment({
                ...payment,
                amount:
                  event.target
                    .value,
              })
            }
            className={inputClass}
          />
        </Field>

        <Field label="Reference">
          <input
            value={
              payment.reference
            }
            onChange={(event) =>
              setPayment({
                ...payment,
                reference:
                  event.target
                    .value,
              })
            }
            className={inputClass}
          />
        </Field>

        <Submit busy={busy}>
          Record payment
        </Submit>
      </form>
    </Section>
  </div>
</div>

);
}

function ParentTab({
parents,
students,
canManage,
busy,
run,
}: {
parents: ErpUser[];
students: ErpUser[];
canManage: boolean;
busy: boolean;
run: (
action: () => Promise<unknown>,
message: string
) => Promise<void>;
}) {
const [form, setForm] =
useState({
parentId: "",
studentId: "",
relationship: "Parent",
});

if (!canManage) {
return <AccessDenied />;
}

return (
<Section title="Link parent to student" description="Both users are validated server-side against the current institution and role." >
<form
className="grid gap-4 md"
onSubmit={(event) => {
event.preventDefault();

      void run(
        () =>
          createParentLink({
            parentId:
              form.parentId,
            studentId:
              form.studentId,
            relationship:
              form.relationship ||
              undefined,
          }),
        "Parent link created"
      );
    }}
  >
    <Field label="Parent">
      <select
        required
        value={
          form.parentId
        }
        onChange={(event) =>
          setForm({
            ...form,
            parentId:
              event.target
                .value,
          })
        }
        className={inputClass}
      >
        <option value="">
          Select parent
        </option>

        {parents.map(
          (parent) => (
            <option
              key={parent.id}
              value={parent.id}
            >
              {
                parent.firstName
              }{" "}
              {
                parent.lastName
              }{" "}
              —{" "}
              {parent.email}
            </option>
          )
        )}
      </select>
    </Field>

    <Field label="Student">
      <select
        required
        value={
          form.studentId
        }
        onChange={(event) =>
          setForm({
            ...form,
            studentId:
              event.target
                .value,
          })
        }
        className={inputClass}
      >
        <option value="">
          Select student
        </option>

        {students.map(
          (student) => (
            <option
              key={
                student.id
              }
              value={
                student.id
              }
            >
              {
                student.firstName
              }{" "}
              {
                student.lastName
              }{" "}
              —{" "}
              {
                student.email
              }
            </option>
          )
        )}
      </select>
    </Field>

    <Field label="Relationship">
      <input
        value={
          form.relationship
        }
        onChange={(event) =>
          setForm({
            ...form,
            relationship:
              event.target
                .value,
          })
        }
        className={inputClass}
      />
    </Field>

    <div className="flex items-end">
      <Submit busy={busy}>
        Create link
      </Submit>
    </div>
  </form>
</Section>

);
}

function NotificationsTab({
notifications,
busy,
onRefresh,
onRead,
onReadAll,
}: {
notifications: {
items: Array<{
id: string;
title: string;
body: string;
readAt: string | null;
createdAt: string;
}>;
unread: number;
};
busy: boolean;
onRefresh: () => Promise<void>;
onRead: (id: string) => void;
onReadAll: () => void;
}) {
return (
<Section
title={`Notifications · ${notifications.unread} unread`}
>
<div className="mb-4 flex gap-2">
<button disabled={busy} onClick={onReadAll} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" >
Mark all read
</button>

    <button
      onClick={() =>
        void onRefresh()
      }
      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
    >
      Refresh
    </button>
  </div>

  {notifications.items
    .length === 0 ? (
    <Empty text="No notifications." />
  ) : (
    <div className="space-y-3">
      {notifications.items.map(
        (notification) => (
          <div
            key={
              notification.id
            }
            className={`rounded-xl border p-4 ${
              notification.readAt
                ? "border-slate-200"
                : "border-slate-300 bg-slate-50"
            }`}
          >
            <div className="flex justify-between gap-4">
              <div>
                <h3 className="font-semibold">
                  {
                    notification.title
                  }
                </h3>

                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {
                    notification.body
                  }
                </p>
              </div>

              {!notification.readAt && (
                <button
                  onClick={() =>
                    onRead(
                      notification.id
                    )
                  }
                  className="shrink-0 text-xs font-bold text-slate-700"
                >
                  Mark read
                </button>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-400">
              {dateValue(
                notification.createdAt
              )}
            </p>
          </div>
        )
      )}
    </div>
  )}
</Section>

);
}

function DocumentsTab({
students,
documents,
canManage,
busy,
run,
}: {
students: ErpUser[];
documents: ErpDocument[];
canManage: boolean;
busy: boolean;
run: (
action: () => Promise<unknown>,
message: string
) => Promise<void>;
onRefresh: () => Promise<void>;
}) {
const [form, setForm] =
useState({
studentId: "",
title: "",
url: "",
type: "OTHER",
});

if (!canManage) {
return (
<Section title="My documents">
<DocumentList documents={documents} />
</Section>
);
}

return (
<div className="grid gap-6 xl:grid-cols-2">
<Section title="Add student document" description="The current backend accepts a document URL rather than binary file upload." >
<form
className="space-y-4"
onSubmit={(event) => {
event.preventDefault();

        void run(
          () =>
            createDocument({
              studentId:
                form.studentId,
              title:
                form.title,
              url: form.url,
              type:
                form.type,
            }),
          "Document created"
        );
      }}
    >
      <Field label="Student">
        <select
          required
          value={
            form.studentId
          }
          onChange={(event) =>
            setForm({
              ...form,
              studentId:
                event.target
                  .value,
            })
          }
          className={inputClass}
        >
          <option value="">
            Select student
          </option>

          {students.map(
            (student) => (
              <option
                key={
                  student.id
                }
                value={
                  student.id
                }
              >
                {
                  student.firstName
                }{" "}
                {
                  student.lastName
                }{" "}
                —{" "}
                {
                  student.email
                }
              </option>
            )
          )}
        </select>
      </Field>

      <Field label="Title">
        <input
          required
          value={form.title}
          onChange={(event) =>
            setForm({
              ...form,
              title:
                event.target
                  .value,
            })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Document URL">
        <input
          required
          type="url"
          value={form.url}
          onChange={(event) =>
            setForm({
              ...form,
              url:
                event.target
                  .value,
            })
          }
          placeholder="https://…"
          className={inputClass}
        />
      </Field>

      <Field label="Type">
        <input
          value={form.type}
          onChange={(event) =>
            setForm({
              ...form,
              type:
                event.target
                  .value,
            })
          }
          className={inputClass}
        />
      </Field>

      <Submit busy={busy}>
        Add document
      </Submit>
    </form>
  </Section>

  <Section title="My documents">
    <DocumentList
      documents={documents}
    />
  </Section>
</div>

);
}

function DocumentList({
documents,
}: {
documents: ErpDocument[];
}) {
if (documents.length === 0) {
return (
<Empty text="No documents available." />
);
}

return (
<div className="space-y-2">
{documents.map(
(document) => (
<a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-4 hover:bg-slate-50" >
<div className="flex justify-between gap-4">
<div>
<p className="font-semibold">
{document.title}
</p>

            <p className="text-xs text-slate-500">
              {document.type}
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-600">
            Open
          </span>
        </div>
      </a>
    )
  )}
</div>

);
}

function Empty({
text,
}: {
text: string;
}) {
return (
<div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
{text}
</div>
);
}

function AccessDenied() {
return (
<div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
<p className="font-bold">
Access restricted
</p>

  <p className="mt-1">
    Your current role does not have
    permission to perform this ERP
    operation. The server remains the
    final authorization layer.
  </p>
</div>

);
}
