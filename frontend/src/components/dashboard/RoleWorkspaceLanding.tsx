"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AccessNotice } from "@/components/dashboard/AccessNotice";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
} from "@/lib/auth";
import {
  hasAnyPermission,
  normalizeRoles,
  type CanonicalRole,
} from "@/lib/authorization";
import {
  ROLE_NAVIGATION,
  WORKSPACE_META,
  getPrimaryRole,
} from "./dashboardNavigation";

function toCanonicalRoles(roles: readonly string[]): CanonicalRole[] {
  const normalized = normalizeRoles(roles);

  return normalized.filter(
    (role): role is CanonicalRole =>
      Object.prototype.hasOwnProperty.call(WORKSPACE_META, role),
  );
}

function flattenNavigation(role: CanonicalRole) {
  return ROLE_NAVIGATION[role].flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      group: group.label,
    })),
  );
}

export function RoleWorkspaceLanding({
  role,
}: {
  role: CanonicalRole;
}) {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(
    getCachedCurrentUser(),
  );

  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    getCurrentUser({ background: Boolean(user) })
      .then((current) => {
        if (mounted) {
          setUser(current);
        }
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }

        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your workspace.",
        );
      });

    return () => {
      mounted = false;
    };
  }, [router, user]);

  const currentRole = useMemo<CanonicalRole | null>(() => {
    if (!user) {
      return role;
    }

    const canonicalRoles = toCanonicalRoles(user.roles);

    return getPrimaryRole(canonicalRoles);
  }, [role, user]);

  useEffect(() => {
    if (!currentRole || currentRole === role) {
      return;
    }

    const target = WORKSPACE_META[currentRole]?.home;

    if (target) {
      router.replace(target);
    }
  }, [currentRole, role, router]);

  if (currentRole && currentRole !== role) {
    return null;
  }

  const meta = WORKSPACE_META[role];

  const available = user
    ? flattenNavigation(role).filter(
        (item) =>
          !item.permissions?.length ||
          hasAnyPermission(user, item.permissions),
      )
    : [];

  const groups = ROLE_NAVIGATION[role]
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.permissions?.length ||
          Boolean(
            user && hasAnyPermission(user, item.permissions),
          ),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const quickStart = available
    .filter(
      (item) =>
        item.href !== meta.home &&
        item.label !== "Account security",
    )
    .slice(0, 4);

  return (
    <DashboardShell
      title={meta.title}
      subtitle={meta.subtitle}
      allowedRoles={[role]}
    >
      <div className="space-y-6">
        {error ? (
          <AccessNotice
            title="We could not load your workspace"
            message="Your sign-in is still active. Refresh the page or return to your workspace and try again."
            href={meta.home}
            actionLabel="Return to workspace"
          />
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />

            <div className="relative max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">
                {meta.eyebrow}
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Welcome to your workspace
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                This is your starting point. Only work relevant to
                your current responsibility is shown here.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Start here
                </p>

                <h3 className="mt-1 text-lg font-black text-slate-900">
                  What do you want to work on?
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {quickStart.map((item) => (
                  <Link
                    key={`${item.href}:${item.label}`}
                    href={item.href}
                    className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-base shadow-sm ring-1 ring-slate-200">
                        {item.icon}
                      </span>

                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">
                          {item.label}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.description}
                        </p>
                      </div>

                      <span className="ml-auto text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700">
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Your workspace
              </p>

              <p className="mt-2 text-xl font-black text-slate-900">
                {meta.label}
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your navigation is automatically limited to the
                responsibilities and permissions assigned to your
                account.
              </p>

              <div className="mt-5 flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {available.length} available tools
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Available work
            </p>

            <h3 className="mt-1 text-xl font-black text-slate-900">
              Everything assigned to this workspace
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Use the categories below when you need something
              specific.
            </p>
          </div>

          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <h4 className="mb-3 text-sm font-black text-slate-800">
                  {group.label}
                </h4>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((item) => (
                    <Link
                      key={`${item.href}:${item.label}`}
                      href={item.href}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-600">
                        {item.icon}
                      </span>

                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900">
                          {item.label}
                        </span>

                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
