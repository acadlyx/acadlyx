"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AuthRequiredError,
  AuthUser,
  authedFetch,
  getCurrentUser,
  isAuthenticated,
  logout,
} from "@/lib/auth";

type Workspace = {
  timetable: unknown[];
  notices: {
    id: string;
    title: string;
    body: string;
  }[];
  notifications: unknown[];
  documents: unknown[];
  fees: unknown[];
  exams: unknown[];
};

interface RoleWorkspaceProps {
  title: string;
  roles: string[];
}

type Metric = {
  label: string;
  value: number;
};

export function RoleWorkspace({
  title,
  roles,
}: RoleWorkspaceProps) {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const allowedRolesKey = useMemo(
    () => roles.join(","),
    [roles],
  );

  useEffect(() => {
    let mounted = true;

    async function loadWorkspace() {
      if (!isAuthenticated()) {
        router.replace("/login");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [currentUser, workspace] =
          await Promise.all([
            getCurrentUser(),
            authedFetch<{
              success: true;
              data: Workspace;
            }>("/erp/me/workspace"),
          ]);

        if (!mounted) {
          return;
        }

        const hasAllowedRole =
          currentUser.roles.some((role) =>
            roles.includes(role),
          );

        if (!hasAllowedRole) {
          router.replace("/login");
          return;
        }

        setUser(currentUser);
        setData(workspace.data);
      } catch (requestError) {
        if (!mounted) {
          return;
        }

        if (
          requestError instanceof AuthRequiredError
        ) {
          router.replace("/login");
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the workspace.",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      mounted = false;
    };
  }, [allowedRolesKey, router, roles]);

  const metrics: Metric[] = useMemo(
    () => [
      {
        label: "Today's timetable",
        value: data?.timetable.length ?? 0,
      },
      {
        label: "Notices",
        value: data?.notices.length ?? 0,
      },
      {
        label: "Notifications",
        value: data?.notifications.length ?? 0,
      },
      {
        label: "Documents",
        value: data?.documents.length ?? 0,
      },
      {
        label: "Fees",
        value: data?.fees.length ?? 0,
      },
      {
        label: "Exam results",
        value: data?.exams.length ?? 0,
      },
    ],
    [data],
  );

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div
            className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading workspace…
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <section className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500">
            Workspace error
          </p>

          <h1 className="mt-2 text-xl font-bold text-slate-950">
            Unable to load your workspace
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (!data || !user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.2em] text-slate-400">
              ACADLYX ERP
            </p>

            <h1 className="mt-1 truncate text-2xl font-bold text-slate-950">
              {title}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {user.firstName} {user.lastName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
          >
            Sign out
          </button>
        </header>

        <section
          aria-label="Workspace metrics"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">
                {metric.label}
              </p>

              <p className="mt-1 text-3xl font-black text-slate-950">
                {metric.value.toLocaleString("en-IN")}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Communication
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-950">
                Current notices
              </h2>
            </div>

            <span className="text-xs font-medium text-slate-400">
              {data.notices.length} active
            </span>
          </div>

          {data.notices.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {data.notices.map((notice) => (
                <li
                  key={notice.id}
                  className="py-4 first:pt-0 last:pb-0"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {notice.title}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {notice.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              No notices available.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
