"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { DashboardShell } from "./DashboardShell";

import {
  AuthRequiredError,
  getCurrentUser,
} from "@/lib/auth";

import {
  getAdminWorkspace,
  type AdminWorkspace,
} from "@/lib/adminApi";

type PeopleCard = {
  key: string;
  title: string;
  description: string;
  href: string;
  module: keyof AdminWorkspace["modules"];
  icon: string;
};

const PEOPLE_CARDS: PeopleCard[] = [
  {
    key: "students",
    title: "Students",
    description:
      "Student master records, academic enrolments, guardians, parent links and complete student profiles.",
    href: "/students",
    module: "students",
    icon: "ST",
  },
  {
    key: "faculty",
    title: "Faculty",
    description:
      "Teaching staff, account details, contact information and faculty records.",
    href: "/user-management?category=faculty",
    module: "users",
    icon: "FC",
  },
  {
    key: "administrators",
    title: "Administrators",
    description:
      "Institution administration accounts and their account status.",
    href: "/user-management?category=administrators",
    module: "users",
    icon: "AD",
  },
  {
    key: "leadership",
    title: "Leadership",
    description:
      "Chairman, director, dean, registrar and HOD records.",
    href: "/user-management?category=leadership",
    module: "users",
    icon: "LD",
  },
  {
    key: "operations",
    title: "Operations",
    description:
      "Accounts, HR, admissions, examination, library, placement and IT users.",
    href: "/user-management?category=operations",
    module: "users",
    icon: "OP",
  },
  {
    key: "parents",
    title: "Parents",
    description:
      "Parent accounts and their relationships with students.",
    href: "/user-management?category=parents",
    module: "parentLinks",
    icon: "PR",
  },
];

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat(
    "en-IN",
  ).format(value ?? 0);
}

export function PeopleLanding() {
  const [workspace, setWorkspace] =
    useState<AdminWorkspace | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const load = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const user =
          await getCurrentUser();

        if (
          !user.roles.includes(
            "INSTITUTION_ADMIN",
          )
        ) {
          setError(
            "This workspace is not available for the current account.",
          );
          return;
        }

        const data =
          await getAdminWorkspace();

        setWorkspace(data);
      } catch (reason) {
        if (
          reason instanceof
          AuthRequiredError
        ) {
          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load People.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const modules =
    workspace?.modules;

  const cards =
    PEOPLE_CARDS.filter(
      (card) =>
        modules?.[card.module] ===
        true,
    );

  return (
    <DashboardShell
      title="People"
      subtitle="Institution people and relationship management"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-[1320px] space-y-6 pb-12">
        <section className="rounded-[30px] border border-[#dce5f0] bg-[#f7faff] p-6 shadow-[0_14px_40px_rgba(31,55,90,0.05)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#d7e4f7] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#2864e8]">
                People directory
              </span>

              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#152238] sm:text-4xl">
                Manage people by responsibility.
              </h1>

              <p className="mt-3 text-sm leading-6 text-[#6f8097] sm:text-[15px]">
                Start with a people category instead
                of browsing one large undifferentiated
                institution user list.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#dce5f0] bg-white px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#94a2b5]">
                  People
                </p>
                <p className="mt-1 text-xl font-black text-[#172033]">
                  {formatNumber(
                    workspace?.stats.users,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-[#dce5f0] bg-white px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#94a2b5]">
                  Students
                </p>
                <p className="mt-1 text-xl font-black text-[#172033]">
                  {formatNumber(
                    workspace?.stats.students,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-[#dce5f0] bg-white px-4 py-3 col-span-2 sm:col-span-1">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#94a2b5]">
                  Faculty
                </p>
                <p className="mt-1 text-xl font-black text-[#172033]">
                  {formatNumber(
                    workspace?.stats.faculty,
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {error}
          </section>
        ) : null}

        <section>
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2864e8]">
              People categories
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#172033]">
              Institution directory
            </h2>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(
                (item) => (
                  <div
                    key={item}
                    className="h-[190px] animate-pulse rounded-[26px] border border-[#e1e8f0] bg-white"
                  />
                ),
              )}
            </div>
          ) : cards.length === 0 ? (
            <section className="rounded-[26px] border border-[#dfe7ef] bg-white p-8 text-center">
              <h3 className="font-black text-[#172033]">
                No people modules are enabled
              </h3>

              <p className="mt-2 text-sm text-[#77879b]">
                The available People categories are
                determined by the authenticated account's
                backend capabilities.
              </p>
            </section>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <Link
                  key={card.key}
                  href={card.href}
                  className="group rounded-[26px] border border-[#dfe7ef] bg-white p-5 shadow-[0_8px_28px_rgba(25,45,75,0.035)] transition hover:-translate-y-1 hover:border-[#cbd9ed] hover:shadow-[0_18px_38px_rgba(25,45,75,0.08)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-[17px] bg-[#edf3ff] text-xs font-black tracking-[0.08em] text-[#2864e8]">
                      {card.icon}
                    </div>

                    <span className="text-xl text-[#bdc8d6] transition group-hover:translate-x-1 group-hover:text-[#2864e8]">
                      →
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-black text-[#1b2940]">
                    {card.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[#74859a]">
                    {card.description}
                  </p>

                  <div className="mt-5 text-xs font-black uppercase tracking-[0.15em] text-[#2864e8]">
                    Open category
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}

export default PeopleLanding;
