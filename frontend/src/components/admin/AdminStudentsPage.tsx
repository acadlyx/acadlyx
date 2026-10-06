"use client";

import {
  useEffect,
  useState,
} from "react";

import { StudentManagement } from "@/components/dashboard/StudentManagement";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
} from "@/lib/auth";

function AdminStudentsPageContent({ departmentId }: { departmentId?: string }) {
  const [user, setUser] =
    useState<AuthUser | null>(
      () =>
        getCachedCurrentUser(),
    );

  const [loading, setLoading] =
    useState(
      !getCachedCurrentUser(),
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    let alive = true;

    getCurrentUser({
      background:
        Boolean(
          getCachedCurrentUser(),
        ),
    })
      .then((currentUser) => {
        if (!alive) {
          return;
        }

        setUser(currentUser);
        setLoading(false);
      })
      .catch((reason) => {
        if (!alive) {
          return;
        }

        if (
          reason instanceof
          AuthRequiredError
        ) {
          window.location.replace(
            "/login",
          );

          return;
        }

        setError(
          reason instanceof
            Error
            ? reason.message
            : "Unable to load authorization.",
        );

        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-[30px] border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading student authorization…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[30px] border border-red-200 bg-red-50 p-8 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (
    !user?.permissions.includes(
      "students.read",
    )
  ) {
    return (
      <div className="rounded-[30px] border border-amber-200 bg-amber-50 p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
          Access restricted
        </p>

        <h1 className="mt-2 text-2xl font-black text-slate-950">
          Students
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your authenticated account does not
          have{" "}
          <code>
            students.read
          </code>{" "}
          permission for this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 pb-10">
      <section className="rounded-[30px] border border-[#dce5f0] bg-[#f7faff] p-6 shadow-[0_12px_34px_rgba(25,45,75,0.04)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2864e8]">
              Student master
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#152238] sm:text-4xl">
              Students
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#718298]">
              Create and maintain complete student
              records. Each student has one master
              profile, academic history and family
              relationship layer.
            </p>
          </div>

          <div className="rounded-[18px] border border-[#d7e4f7] bg-white px-4 py-3 text-xs font-black text-[#2864e8]">
            Institution-scoped
          </div>
        </div>
      </section>

      <StudentManagement departmentId={departmentId} />
    </div>
  );
}


export function AdminStudentsPage({ departmentId }: { departmentId?: string }) {
  return (
    <DashboardShell
      title="Students"
      subtitle="Institution-scoped administration"
      allowedRoles={["INSTITUTION_ADMIN", "REGISTRAR"]}
    >
      <AdminStudentsPageContent departmentId={departmentId} />
    </DashboardShell>
  );
}
