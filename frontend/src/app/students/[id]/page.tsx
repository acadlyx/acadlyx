"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  authedFetch,
} from "@/lib/auth";

type Lookup = {
  id: string;
  name?: string | null;
  code?: string | null;
  number?: number | null;
};

type Enrollment = {
  id: string;
  academicYearId: string;
  programId: string;
  semesterId?: string | null;
  sectionId?: string | null;
  rollNumber?: string | null;
  status: string;
  enrolledAt?: string;
  program?: Lookup | null;
  academicYear?: Lookup | null;
  semester?: Lookup | null;
  section?: Lookup | null;
};

type Student = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  profile?: {
    admissionNumber?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    bloodGroup?: string | null;
    nationality?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
    guardianEmail?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    admissionDate?: string | null;
    status?: string | null;
  } | null;
  enrollments?: Enrollment[];
  currentEnrollment?: Enrollment | null;
};

type ParentLink = {
  parentId: string;
  studentId: string;
  relationship?: string | null;
  createdAt?: string;
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  };
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile?: {
      admissionNumber?: string | null;
    } | null;
  };
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  roles?: {
    id: string;
    name: string;
  }[];
};

type Envelope<T> = {
  success?: boolean;
  data?: T;
};

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(value).slice(
      0,
      10,
    );
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function value(
  item: unknown,
) {
  if (
    item === null ||
    item === undefined ||
    item === ""
  ) {
    return "—";
  }

  return String(item);
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
    <section className="rounded-[24px] border border-[#dfe7ef] bg-white p-5 shadow-[0_8px_26px_rgba(25,45,75,0.035)] sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-black text-[#172033]">
          {title}
        </h2>

        {description ? (
          <p className="mt-1 text-xs leading-5 text-[#7c8ca0]">
            {description}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function DataGrid({
  items,
}: {
  items: Array<{
    label: string;
    value: unknown;
  }>;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-[#98a6b7]">
            {item.label}
          </dt>

          <dd className="mt-1 text-sm font-semibold text-[#334158]">
            {value(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function StudentProfilePage({
  params,
}: {
  params: {
    id: string;
  };
}) {
  const [student, setStudent] =
    useState<Student | null>(null);

  const [parentLinks, setParentLinks] =
    useState<ParentLink[]>([]);

  const [parents, setParents] =
    useState<User[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [savingLink, setSavingLink] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [showParentForm, setShowParentForm] =
    useState(false);

  const [parentId, setParentId] =
    useState("");

  const [relationship, setRelationship] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        studentResponse,
        parentResponse,
        parentUsersResponse,
      ] = await Promise.all([
        authedFetch<
          Envelope<Student>
        >(
          `/students/${params.id}`,
        ),

        authedFetch<
          Envelope<ParentLink[]>
        >(
          `/erp/parent-links?studentId=${encodeURIComponent(
            params.id,
          )}`,
        ),

        authedFetch<
          Envelope<
            User[] | {
              items: User[];
            }
          >
        >(
          "/users?role=PARENT&page=1&pageSize=200",
        ),
      ]);

      setStudent(
        studentResponse.data ||
          null,
      );

      setParentLinks(
        parentResponse.data ||
          [],
      );

      const parentData =
        parentUsersResponse.data;

      setParents(
        Array.isArray(parentData)
          ? parentData
          : parentData?.items ||
              [],
      );
    } catch (reason) {
      if (
        reason instanceof
        AuthRequiredError
      ) {
        setError(
          "Your session has expired. Please sign in again.",
        );
      } else {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load the student profile.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  const availableParents =
    useMemo(() => {
      const linkedIds =
        new Set(
          parentLinks.map(
            (link) =>
              link.parentId,
          ),
        );

      return parents.filter(
        (parent) =>
          !linkedIds.has(
            parent.id,
          ),
      );
    }, [parents, parentLinks]);

  async function linkParent(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!parentId) {
      setError(
        "Select a parent account.",
      );
      return;
    }

    setSavingLink(true);
    setError("");
    setSuccess("");

    try {
      await authedFetch(
        "/erp/parent-links",
        {
          method: "POST",
          body: JSON.stringify({
            parentId,
            studentId:
              params.id,
            relationship:
              relationship.trim() ||
              undefined,
          }),
        },
      );

      setParentId("");
      setRelationship("");
      setShowParentForm(false);

      setSuccess(
        "Parent linked to the student successfully.",
      );

      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to create the parent link.",
      );
    } finally {
      setSavingLink(false);
    }
  }

  async function removeParent(
    link: ParentLink,
  ) {
    setSavingLink(true);
    setError("");
    setSuccess("");

    try {
      await authedFetch(
        `/erp/parent-links/${encodeURIComponent(
          link.parentId,
        )}/${encodeURIComponent(
          link.studentId,
        )}`,
        {
          method: "DELETE",
        },
      );

      setSuccess(
        "Parent link removed successfully.",
      );

      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to remove the parent link.",
      );
    } finally {
      setSavingLink(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell
        title="Student Profile"
        subtitle="Loading student record"
        allowedRoles={[
          "INSTITUTION_ADMIN",
        ]}
      >
        <main className="mx-auto max-w-[1320px] pb-12">
          <div className="animate-pulse rounded-[28px] border border-[#dfe7ef] bg-white p-8">
            <div className="h-8 w-72 rounded bg-[#edf1f6]" />
            <div className="mt-4 h-4 w-96 max-w-full rounded bg-[#edf1f6]" />

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="h-48 rounded-2xl bg-[#f3f6fa]" />
              <div className="h-48 rounded-2xl bg-[#f3f6fa]" />
            </div>
          </div>
        </main>
      </DashboardShell>
    );
  }

  if (!student) {
    return (
      <DashboardShell
        title="Student Profile"
        subtitle="Student record"
        allowedRoles={[
          "INSTITUTION_ADMIN",
        ]}
      >
        <main className="mx-auto max-w-[1000px] pb-12">
          <section className="rounded-[28px] border border-red-200 bg-red-50 p-7">
            <h1 className="font-black text-red-900">
              Student profile unavailable
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error ||
                "The requested student could not be found."}
            </p>

            <Link
              href="/students"
              className="mt-5 inline-flex rounded-xl bg-red-700 px-4 py-2.5 text-sm font-black text-white"
            >
              Back to Students
            </Link>
          </section>
        </main>
      </DashboardShell>
    );
  }

  const profile =
    student.profile;

  const enrollment =
    student.currentEnrollment;

  return (
    <DashboardShell
      title="Student Profile"
      subtitle="Complete student master record"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-[1320px] space-y-5 pb-12">
        <section className="rounded-[30px] border border-[#dce5f0] bg-[#f7faff] p-6 shadow-[0_12px_34px_rgba(25,45,75,0.04)] sm:p-8">
          <Link
            href="/students"
            className="text-xs font-black uppercase tracking-[0.15em] text-[#2864e8]"
          >
            ← Students
          </Link>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-[#e8f0ff] text-lg font-black text-[#2864e8]">
                {student.firstName?.[0] || ""}
                {student.lastName?.[0] || ""}
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2864e8]">
                  Student master record
                </p>

                <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#152238]">
                  {student.firstName}{" "}
                  {student.lastName}
                </h1>

                <p className="mt-1 text-sm text-[#718298]">
                  {value(
                    profile?.admissionNumber,
                  )}{" "}
                  ·{" "}
                  {student.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/students"
                className="rounded-xl border border-[#d7e0ea] bg-white px-4 py-2.5 text-sm font-black text-[#42536b]"
              >
                Back to directory
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        {success ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            {success}
          </section>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-2">
          <Section
            title="Personal information"
            description="Core identity and demographic information."
          >
            <DataGrid
              items={[
                {
                  label: "First name",
                  value:
                    student.firstName,
                },
                {
                  label: "Last name",
                  value:
                    student.lastName,
                },
                {
                  label: "Email",
                  value:
                    student.email,
                },
                {
                  label: "Phone",
                  value:
                    student.phone,
                },
                {
                  label: "Date of birth",
                  value:
                    formatDate(
                      profile?.dateOfBirth,
                    ),
                },
                {
                  label: "Gender",
                  value:
                    profile?.gender,
                },
                {
                  label: "Blood group",
                  value:
                    profile?.bloodGroup,
                },
                {
                  label: "Nationality",
                  value:
                    profile?.nationality,
                },
                {
                  label: "Admission date",
                  value:
                    formatDate(
                      profile?.admissionDate,
                    ),
                },
                {
                  label: "Status",
                  value:
                    profile?.status,
                },
                {
                  label: "Account status",
                  value:
                    student.isActive
                      ? "Active"
                      : "Inactive",
                },
                {
                  label: "Admission number",
                  value:
                    profile?.admissionNumber,
                },
              ]}
            />

            <div className="mt-6 border-t border-[#edf0f4] pt-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#98a6b7]">
                Address
              </p>

              <p className="mt-2 text-sm font-semibold leading-6 text-[#334158]">
                {[
                  profile?.address,
                  profile?.city,
                  profile?.state,
                  profile?.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ") ||
                  "No address recorded"}
              </p>
            </div>
          </Section>

          <Section
            title="Current academic placement"
            description="The student's current academic enrollment."
          >
            <DataGrid
              items={[
                {
                  label: "Academic year",
                  value:
                    enrollment
                      ?.academicYear
                      ?.name,
                },
                {
                  label: "Program",
                  value:
                    enrollment
                      ?.program
                      ?.name,
                },
                {
                  label: "Program code",
                  value:
                    enrollment
                      ?.program
                      ?.code,
                },
                {
                  label: "Semester",
                  value:
                    enrollment
                      ?.semester
                      ?.name,
                },
                {
                  label: "Section",
                  value:
                    enrollment
                      ?.section
                      ?.name,
                },
                {
                  label: "Roll number",
                  value:
                    enrollment?.rollNumber,
                },
                {
                  label: "Enrollment status",
                  value:
                    enrollment?.status,
                },
                {
                  label: "Enrolled on",
                  value:
                    formatDate(
                      enrollment?.enrolledAt,
                    ),
                },
              ]}
            />
          </Section>
        </div>

        <Section
          title="Guardian and emergency information"
          description="Family and emergency information stored on the student master record."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#f7f9fc] p-5">
              <h3 className="font-black text-[#1b2940]">
                Guardian
              </h3>

              <div className="mt-4">
                <DataGrid
                  items={[
                    {
                      label: "Name",
                      value:
                        profile?.guardianName,
                    },
                    {
                      label: "Phone",
                      value:
                        profile?.guardianPhone,
                    },
                    {
                      label: "Email",
                      value:
                        profile?.guardianEmail,
                    },
                  ]}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-[#f7f9fc] p-5">
              <h3 className="font-black text-[#1b2940]">
                Emergency contact
              </h3>

              <div className="mt-4">
                <DataGrid
                  items={[
                    {
                      label: "Name",
                      value:
                        profile?.emergencyContactName,
                    },
                    {
                      label: "Phone",
                      value:
                        profile?.emergencyContactPhone,
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Parents and guardians linked to this student"
          description="These relationships come from the institution's parent-student relationship table."
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#718298]">
              {parentLinks.length
                ? `${parentLinks.length} linked parent account${
                    parentLinks.length === 1
                      ? ""
                      : "s"
                  }.`
                : "No parent account is linked yet."}
            </p>

            <button
              type="button"
              onClick={() =>
                setShowParentForm(
                  (current) =>
                    !current,
                )
              }
              className="rounded-xl bg-[#2864e8] px-4 py-2.5 text-sm font-black text-white"
            >
              {showParentForm
                ? "Close"
                : "Link parent"}
            </button>
          </div>

          {showParentForm ? (
            <form
              onSubmit={linkParent}
              className="mt-5 rounded-2xl border border-[#dfe7ef] bg-[#f8faff] p-5"
            >
              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
                <label>
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[#98a6b7]">
                    Parent account
                  </span>

                  <select
                    value={parentId}
                    onChange={(event) =>
                      setParentId(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-[#d7e0ea] bg-white px-3 py-2.5 text-sm font-semibold text-[#334158] outline-none focus:border-[#2864e8]"
                  >
                    <option value="">
                      Select parent
                    </option>

                    {availableParents.map(
                      (parent) => (
                        <option
                          key={parent.id}
                          value={parent.id}
                        >
                          {parent.firstName}{" "}
                          {parent.lastName} —{" "}
                          {parent.email}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[#98a6b7]">
                    Relationship
                  </span>

                  <input
                    value={
                      relationship
                    }
                    onChange={(event) =>
                      setRelationship(
                        event.target.value,
                      )
                    }
                    placeholder="Mother / Father / Guardian"
                    className="w-full rounded-xl border border-[#d7e0ea] bg-white px-3 py-2.5 text-sm text-[#334158] outline-none focus:border-[#2864e8]"
                  />
                </label>

                <button
                  disabled={
                    savingLink ||
                    !parentId
                  }
                  type="submit"
                  className="rounded-xl bg-[#172033] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  {savingLink
                    ? "Saving..."
                    : "Link"}
                </button>
              </div>

              {!availableParents.length ? (
                <p className="mt-3 text-xs text-[#7c8ca0]">
                  There are no unlinked parent accounts
                  available. Create a PARENT account first
                  if required.
                </p>
              ) : null}
            </form>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {parentLinks.map(
              (link) => (
                <div
                  key={`${link.parentId}:${link.studentId}`}
                  className="rounded-2xl border border-[#e1e7ee] bg-[#fbfcfe] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-black text-[#1b2940]">
                        {link.parent.firstName}{" "}
                        {link.parent.lastName}
                      </h3>

                      <p className="mt-1 text-xs text-[#7c8ca0]">
                        {link.relationship ||
                          "Parent / Guardian"}
                      </p>

                      <p className="mt-3 text-sm text-[#53647b]">
                        {link.parent.email}
                      </p>

                      <p className="mt-1 text-sm text-[#53647b]">
                        {link.parent.phone ||
                          "No phone"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={
                        savingLink
                      }
                      onClick={() =>
                        void removeParent(
                          link,
                        )
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </Section>

        <Section
          title="Academic history"
          description="Historical enrollments remain visible instead of being overwritten."
        >
          {student.enrollments?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#edf0f4] text-[10px] font-black uppercase tracking-[0.14em] text-[#98a6b7]">
                    <th className="px-3 py-3">
                      Academic year
                    </th>
                    <th className="px-3 py-3">
                      Program
                    </th>
                    <th className="px-3 py-3">
                      Semester
                    </th>
                    <th className="px-3 py-3">
                      Section
                    </th>
                    <th className="px-3 py-3">
                      Roll
                    </th>
                    <th className="px-3 py-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {student.enrollments.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#f0f2f5] last:border-0"
                      >
                        <td className="px-3 py-4 font-semibold text-[#334158]">
                          {value(
                            item
                              .academicYear
                              ?.name,
                          )}
                        </td>

                        <td className="px-3 py-4 text-[#53647b]">
                          {value(
                            item
                              .program
                              ?.name,
                          )}
                        </td>

                        <td className="px-3 py-4 text-[#53647b]">
                          {value(
                            item
                              .semester
                              ?.name,
                          )}
                        </td>

                        <td className="px-3 py-4 text-[#53647b]">
                          {value(
                            item
                              .section
                              ?.name,
                          )}
                        </td>

                        <td className="px-3 py-4 text-[#53647b]">
                          {value(
                            item.rollNumber,
                          )}
                        </td>

                        <td className="px-3 py-4">
                          <span className="rounded-full bg-[#edf3ff] px-2.5 py-1 text-xs font-black text-[#2864e8]">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[#7c8ca0]">
              No academic enrollment history is available.
            </p>
          )}
        </Section>
      </main>
    </DashboardShell>
  );
}
