"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "./DashboardShell";

import {
  AuthRequiredError,
  AuthUser,
  getCurrentUser,
} from "@/lib/auth";

import {
  getAdminWorkspace,
  AdminWorkspace,
} from "@/lib/adminApi";

import {
  getInstitutionAdminNavigation,
  type InstitutionAdminNavItem,
} from "@/lib/institutionAdminNavigation";

const ICON_PATHS: Record<string, string> = {
  home:
    "M4 10.5 12 4l8 6.5M6.5 9v9h11V9M9.5 18v-5h5v5",

  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",

  calendar:
    "M5 4v3M19 4v3M4 8.5h16M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5V6a2.5 2.5 0 0 1 2.5-2.5ZM8 12h3M13 12h3M8 15.5h3",

  notice:
    "M5 8.5a7 7 0 0 1 14 0v4l2 2H3l2-2v-4ZM9 17h6M10 20h4",

  date:
    "M6 3.5v3M18 3.5v3M4 8.5h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

  bell:
    "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5",

  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.6a7.8 7.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2.4 1 2 3.4 2.4-1a7.8 7.8 0 0 0 2 1.2l.3 2.6h4.4l.3-2.6a7.8 7.8 0 0 0 2-1.2l2.4 1 2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",

  shield:
    "M12 3.5 19 6v5.5c0 4.6-2.9 7.9-7 9.5-4.1-1.6-7-4.9-7-9.5V6l7-2.5ZM9 12l2 2 4-4",

  admissions:
    "M5 19.5h14M7 16.5h10M8 13.5h8M9.5 10.5h5M12 4v4.5",

  reports:
    "M5 19.5V5h14v14.5M8.5 16v-3M12 16V9M15.5 16v-5",

  intelligence:
    "M12 3.5 14 9l5.5 1.5L14 12l-2 6-2-6-5.5-1.5L10 9l2-5.5ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16",

  registration:
    "M6 4.5h12v15H6zM9 8h6M9 12h6M9 16h4",

  movement:
    "M12 4v16M7 9l5-5 5 5M7 15l5 5 5-5",

  certificate:
    "M7 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM8.5 8h7M8.5 12h7M8.5 16h4",
};

function Icon({
  name,
}: {
  name: string;
}) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-[#edf3ff] text-[#2864e8]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          d={
            ICON_PATHS[name] ||
            ICON_PATHS.home
          }
        />
      </svg>
    </span>
  );
}

function number(
  value: unknown,
) {
  return new Intl.NumberFormat(
    "en-IN",
  ).format(
    typeof value ===
      "number" &&
      Number.isFinite(
        value,
      )
      ? value
      : 0,
  );
}

function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: unknown;
  helper: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#dfe7ee] bg-white px-4 py-4 shadow-[0_5px_18px_rgba(20,32,50,0.035)]">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#93a1b2]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#172033]">
        {number(value)}
      </p>

      <p className="mt-1 text-[11px] font-medium text-[#8998aa]">
        {helper}
      </p>
    </div>
  );
}

function WorkspaceCard({
  item,
}: {
  item: InstitutionAdminNavItem;
}) {
  return (
    <Link
      href={item.href}
      className="group rounded-[22px] border border-[#dfe7ee] bg-white p-4 shadow-[0_6px_22px_rgba(20,32,50,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd9ee] hover:shadow-[0_14px_30px_rgba(20,32,50,0.07)]"
    >
      <div className="flex items-start gap-3.5">
        <Icon name={item.icon} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-extrabold text-[#1d2a40]">
              {item.label}
            </h3>

            <span className="text-lg text-[#c2ccd7] transition group-hover:translate-x-0.5 group-hover:text-[#2864e8]">
              →
            </span>
          </div>

          <p className="mt-1.5 text-sm leading-5 text-[#74859a]">
            {item.description}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function AdminPortal() {
  const router =
    useRouter();

  const [
    user,
    setUser,
  ] = useState<AuthUser | null>(
    null,
  );

  const [
    workspace,
    setWorkspace,
  ] =
    useState<
      AdminWorkspace | null
    >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            currentUser,
            data,
          ] =
            await Promise.all([
              getCurrentUser(),
              getAdminWorkspace(),
            ]);

          if (
            !currentUser.roles.includes(
              "INSTITUTION_ADMIN",
            )
          ) {
            router.replace(
              "/login",
            );

            return;
          }

          setUser(
            currentUser,
          );

          setWorkspace(
            data,
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
              : "Unable to load the administration workspace.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [router],
    );

  useEffect(() => {
    void load();
  }, [load]);

  const navigation =
    useMemo(
      () =>
        getInstitutionAdminNavigation(
          user,
        ),
      [user],
    );

  const modules =
    navigation.filter(
      (item) =>
        item.href !==
          "/admin" &&
        item.href !==
          "/account-security",
    );

  const stats =
    workspace?.stats;

  return (
    <DashboardShell
      title="Institution Admin"
      subtitle="Institution administration workspace"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-[1320px] space-y-5 pb-10">
        <section className="overflow-hidden rounded-[28px] border border-[#dfe7ee] bg-white shadow-[0_10px_32px_rgba(20,32,50,0.045)]">
          <div className="grid gap-0 lg:grid-cols-[1.35fr_.65fr]">
            <div className="relative overflow-hidden px-5 py-7 sm:px-8 sm:py-9">
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e6efff] blur-3xl" />

              <div className="relative max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#dce7f8] bg-[#f2f6fd] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#2864e8]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2864e8]" />
                  Institution workspace
                </div>

                <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-[#172033] sm:text-4xl">
                  Run the institution from one focused workspace.
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#718298] sm:text-[15px]">
                  People, academic operations,
                  institutional services and
                  oversight — with specialist
                  modules kept behind their own
                  authority boundaries.
                </p>

                <div className="mt-6 flex flex-wrap gap-2.5">
                  {navigation.some(
                    (item) =>
                      item.href ===
                      "/user-management",
                  ) ? (
                    <Link
                      href="/user-management"
                      className="rounded-[14px] bg-[#2864e8] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(40,100,232,0.2)] transition hover:bg-[#1f57d0]"
                    >
                      Manage people
                    </Link>
                  ) : null}

                  <Link
                    href="/account-security"
                    className="rounded-[14px] border border-[#dbe3eb] bg-white px-4 py-2.5 text-sm font-extrabold text-[#40516a] transition hover:bg-[#f6f8fa]"
                  >
                    Account security
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-[#e6ebf0] bg-[#f7f9fb] p-4 lg:border-l lg:border-t-0 sm:p-5">
              <p className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#92a1b4]">
                Institution snapshot
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <Metric
                  label="People"
                  value={
                    stats?.users
                  }
                  helper="accounts"
                />

                <Metric
                  label="Students"
                  value={
                    stats?.students
                  }
                  helper="active"
                />

                <Metric
                  label="Faculty"
                  value={
                    stats?.faculty
                  }
                  helper="active"
                />

                <Metric
                  label="Departments"
                  value={
                    stats?.departments
                  }
                  helper="active"
                />
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                void load()
              }
              className="rounded-[11px] bg-red-700 px-3.5 py-2 text-xs font-extrabold text-white"
            >
              Retry
            </button>
          </section>
        ) : null}

        <section>
          <div className="mb-3 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2864e8]">
              Authorized areas
            </p>

            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-xl font-black tracking-[-0.025em] text-[#172033] sm:text-2xl">
                Institution operations
              </h2>

              <p className="text-xs font-medium text-[#8a99aa]">
                Only permission-backed
                destinations are shown.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                1,
                2,
                3,
                4,
                5,
                6,
              ].map(
                (item) => (
                  <div
                    key={
                      item
                    }
                    className="h-[112px] animate-pulse rounded-[22px] border border-[#e1e8ee] bg-[#f7f9fb]"
                  />
                ),
              )}
            </div>
          ) : modules.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {modules.map(
                (item) => (
                  <WorkspaceCard
                    key={
                      item.href
                    }
                    item={
                      item
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-[#cfd9e3] bg-white p-8 text-center text-sm text-[#74859a]">
              No permission-backed
              institution modules are
              available for this account.
            </div>
          )}
        </section>

        <section className="rounded-[22px] border border-[#dfe7ee] bg-[#f7f9fb] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#92a1b4]">
            Authority boundary
          </p>

          <h2 className="mt-1 text-lg font-black text-[#243149]">
            Specialist ownership stays explicit.
          </h2>

          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#74859a]">
            Finance, examination, attendance,
            HR, library, placement and other
            specialist operations are not
            presented as Institution Admin tools
            unless the authenticated account
            actually carries the corresponding
            permission.
          </p>
        </section>
      </main>
    </DashboardShell>
  );
}
