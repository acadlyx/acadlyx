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
  code: string;
};

const PEOPLE_CARDS: PeopleCard[] = [
  {
    key: "students",
    title: "Students",
    description:
      "Student records, enrolments, guardians, parent relationships and academic information.",
    href: "/students",
    module: "students",
    code: "ST",
  },
  {
    key: "faculty",
    title: "Faculty",
    description:
      "Teaching staff records, contact information, accounts and professional details.",
    href: "/user-management?category=faculty",
    module: "users",
    code: "FC",
  },
  {
    key: "administrators",
    title: "Administrators",
    description:
      "Institution administration accounts, access status and user information.",
    href: "/user-management?category=administrators",
    module: "users",
    code: "AD",
  },
  {
    key: "leadership",
    title: "Leadership",
    description:
      "Leadership records including directors, deans, registrars and department heads.",
    href: "/user-management?category=leadership",
    module: "users",
    code: "LD",
  },
  {
    key: "operations",
    title: "Operations",
    description:
      "Operational staff and institution users organised by their working responsibility.",
    href: "/user-management?category=operations",
    module: "users",
    code: "OP",
  },
  {
    key: "parents",
    title: "Parents",
    description:
      "Parent accounts, linked students and relationship information.",
    href: "/user-management?category=parents",
    module: "parentLinks",
    code: "PR",
  },
];

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat("en-IN").format(
    value ?? 0,
  );
}

function StatBlock({
  label,
  value,
  code,
}: {
  label: string;
  value: number | undefined;
  code: string;
}) {
  return (
    <div className="border border-[#d8cdbb] bg-[#fbf8f1] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#897d6d]">
          {label}
        </span>

        <span className="text-[10px] font-black tracking-[0.12em] text-[#a58b65]">
          {code}
        </span>
      </div>

      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#29251f]">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function PeopleCardSkeleton({
  index,
}: {
  index: number;
}) {
  return (
    <div
      key={index}
      className="border border-[#d8cdbb] bg-[#fbf8f1] p-5"
    >
      <div className="h-10 w-10 animate-pulse bg-[#e8dfd1]" />

      <div className="mt-5 h-5 w-32 animate-pulse bg-[#e8dfd1]" />

      <div className="mt-3 h-4 w-full animate-pulse bg-[#e8dfd1]" />

      <div className="mt-2 h-4 w-4/5 animate-pulse bg-[#e8dfd1]" />

      <div className="mt-6 h-3 w-24 animate-pulse bg-[#e8dfd1]" />
    </div>
  );
}

export function PeopleLanding() {
  const [workspace, setWorkspace] =
    useState<AdminWorkspace | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    setError("");

    try {
      const user = await getCurrentUser();

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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const modules =
    workspace?.modules;

  const cards =
    PEOPLE_CARDS.filter(
      (card) =>
        modules?.[card.module] === true,
    );

  return (
    <DashboardShell
      title="People"
      subtitle="Institution people and relationship management"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="min-h-full bg-[#eee6d8] px-4 py-5 text-[#29251f] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          {/* PAGE HEADER */}
          <section className="border border-[#d2c5b3] bg-[#f8f4eb]">
            <div className="flex flex-col border-b border-[#d2c5b3] px-5 py-6 sm:px-7 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="border border-[#bca989] bg-[#eee3d0] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#705a3b]">
                    People
                  </span>

                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a8d7b]">
                    Institution administration
                  </span>
                </div>

                <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-[#29251f] sm:text-4xl">
                  People directory
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#746a5c]">
                  Manage people through their institution
                  responsibility instead of one large
                  undifferentiated user list.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2 lg:mt-0">
                <div className="border border-[#d2c5b3] bg-[#eee6d8] px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#897d6d]">
                    Workspace
                  </span>

                  <p className="mt-1 text-xs font-black text-[#40382e]">
                    Institution Admin
                  </p>
                </div>
              </div>
            </div>

            {/* SUMMARY STRIP */}
            <div className="grid grid-cols-1 border-t-0 sm:grid-cols-3">
              <StatBlock
                label="People"
                value={
                  workspace?.stats.users
                }
                code="ALL"
              />

              <StatBlock
                label="Students"
                value={
                  workspace?.stats.students
                }
                code="ST"
              />

              <StatBlock
                label="Faculty"
                value={
                  workspace?.stats.faculty
                }
                code="FC"
              />
            </div>
          </section>

          {/* ERROR */}
          {error ? (
            <section className="mt-5 border border-[#d5bfa0] bg-[#f8efe1] px-5 py-4">
              <div className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 border border-[#a8885f] bg-[#ead9bd] text-center text-[10px] font-black leading-5 text-[#634e31]">
                  !
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#634e31]">
                    Workspace information
                  </p>

                  <p className="mt-1 text-sm text-[#776652]">
                    {error}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {/* CATEGORY HEADER */}
          <section className="mt-8">
            <div className="mb-4 flex flex-col gap-2 border-b border-[#d2c5b3] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7650]">
                  Directory
                </p>

                <h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-[#29251f]">
                  People categories
                </h2>
              </div>

              <p className="text-xs text-[#897d6d]">
                Select a category to continue
              </p>
            </div>

            {/* LOADING */}
            {loading ? (
              <div className="grid gap-px border border-[#d2c5b3] bg-[#d2c5b3] md:grid-cols-2 xl:grid-cols-3">
                {[
                  1,
                  2,
                  3,
                  4,
                  5,
                  6,
                ].map((item) => (
                  <PeopleCardSkeleton
                    key={item}
                    index={item}
                  />
                ))}
              </div>
            ) : cards.length === 0 ? (
              <section className="border border-[#d2c5b3] bg-[#f8f4eb] p-8">
                <div className="max-w-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a7650]">
                    Directory
                  </p>

                  <h3 className="mt-2 text-xl font-black text-[#29251f]">
                    No People categories available
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[#746a5c]">
                    Available People categories are
                    determined by the capabilities of the
                    authenticated institution account.
                  </p>
                </div>
              </section>
            ) : (
              <div className="grid gap-px border border-[#d2c5b3] bg-[#d2c5b3] md:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => (
                  <Link
                    key={card.key}
                    href={card.href}
                    className="group min-h-[215px] bg-[#fbf8f1] p-5 transition-colors hover:bg-[#f4ede1]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="grid h-11 w-11 place-items-center border border-[#c9b99f] bg-[#eee3d0] text-[11px] font-black tracking-[0.08em] text-[#705a3b]">
                        {card.code}
                      </div>

                      <span className="border border-transparent px-2 py-1 text-sm font-black text-[#9b8b76] transition-colors group-hover:border-[#c9b99f] group-hover:bg-[#eee3d0] group-hover:text-[#604d32]">
                        →
                      </span>
                    </div>

                    <h3 className="mt-6 text-lg font-black tracking-[-0.025em] text-[#29251f]">
                      {card.title}
                    </h3>

                    <p className="mt-2 max-w-sm text-sm leading-6 text-[#766b5c]">
                      {card.description}
                    </p>

                    <div className="mt-7 flex items-center justify-between border-t border-[#e0d6c8] pt-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#8c7453]">
                        Open category
                      </span>

                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a29583]">
                        {card.code}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* FOOTER INFORMATION */}
          <section className="mt-6 border border-[#d2c5b3] bg-[#e7ddcd] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-[#6f6455]">
                People are organised by responsibility to
                keep administration workflows clear.
              </p>

              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#927c5e]">
                ACADLYX ERP
              </span>
            </div>
          </section>
        </div>
      </main>
    </DashboardShell>
  );
}

export default PeopleLanding;
