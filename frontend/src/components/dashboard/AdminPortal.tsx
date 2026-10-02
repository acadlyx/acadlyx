"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
} from "@/lib/auth";

import {
  AdminWorkspace,
  getAdminWorkspace,
} from "@/lib/adminApi";

import {
  getAdminNavigation,
} from "@/lib/adminNavigation";

import DataTransferActions from "@/components/dashboard/DataTransferActions";

const METRICS: [
  string,
  keyof AdminWorkspace["stats"],
  string,
][] = [
  ["People", "users", "users.read"],
  ["Students", "students", "students.read"],
  ["Departments", "departments", "departments.read"],
  ["Programs", "programs", "programs.read"],
  ["Courses", "courses", "courses.read"],
  ["Offerings", "offerings", "course-offerings.read"],
  ["Campuses", "campuses", "campuses.read"],
  ["Notices", "notices", "notices.read"],
];

export function AdminPortal() {
  const router =
    useRouter();

  const [user, setUser] =
    useState<AuthUser | null>(
      () =>
        getCachedCurrentUser(),
    );

  const [data, setData] =
    useState<AdminWorkspace | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            currentUser,
            workspace,
          ] =
            await Promise.all([
              getCurrentUser({
                background: true,
              }),
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

          setData(
            workspace,
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
              : "Unable to load the admin workspace.",
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

  const navigation =
    useMemo(
      () =>
        getAdminNavigation(
          user,
        ).filter(
          (item) =>
            item.href !==
            "/admin",
        ),
      [user],
    );

  const metrics =
    METRICS.filter(
      ([, , permission]) =>
        user?.permissions.includes(
          permission,
        ),
    );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-10">
      <section className="relative overflow-hidden rounded-[32px] bg-[#07111f] p-6 text-white shadow-[0_25px_80px_rgba(15,23,42,.18)] sm:p-9">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />

        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">
            Institution command center
          </p>

          <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Everything you are authorized to operate,
            in one place.
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
            Every workspace below is permission-driven.
            Move between modules without losing the
            mounted admin shell.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {user?.permissions.includes(
              "users.read",
            ) ? (
              <Link
                href="/admin/users"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Manage people
              </Link>
            ) : null}

            <Link
              href="/account-security"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black"
            >
              Security
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}

          <button
            type="button"
            onClick={() =>
              void load()
            }
            className="ml-3 underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-32 rounded-[26px] bg-white animate-pulse"
                />
              ),
            )}
          </section>

          <section className="h-96 rounded-[30px] bg-white animate-pulse" />
        </>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(
              ([label, key]) => (
                <div
                  key={key}
                  className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {label}
                  </p>

                  <p className="mt-3 text-3xl font-black tracking-[-0.04em]">
                    {new Intl.NumberFormat(
                      "en-IN",
                    ).format(
                      Number(
                        data?.stats[key] ||
                          0,
                      ),
                    )}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Institution-scoped records
                  </p>
                </div>
              ),
            )}
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                  Data operations
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">Import & export</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Move institution data in validated spreadsheet formats without leaving the admin dashboard.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DataTransferActions type="users" compact />
                <DataTransferActions type="students" compact />
                <DataTransferActions type="faculty" compact />
                <DataTransferActions type="departments" compact />
                <DataTransferActions type="programs" compact />
                <DataTransferActions type="courses" compact />
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              Authorized workspaces
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
              Operate by domain
            </h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {navigation.map(
                (item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 hover:border-blue-200 hover:bg-white hover:shadow-lg"
                  >
                    <div className="flex gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-lg font-black text-blue-600">
                        {item.icon}
                      </span>

                      <div>
                        <h3 className="font-black">
                          {item.label}
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                ),
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
