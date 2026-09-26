"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StudentManagement } from "@/components/dashboard/StudentManagement";
import { authedFetch } from "@/lib/auth";

type StudentSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profile?: {
    admissionNumber?: string | null;
  } | null;
};

type StudentListResponse = {
  success?: boolean;
  data?: StudentSummary[];
};

export default function StudentsPage() {
  const [students, setStudents] =
    useState<StudentSummary[]>([]);

  const [loadingQuickLinks, setLoadingQuickLinks] =
    useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response =
          await authedFetch<
            StudentListResponse
          >(
            "/students?page=1&pageSize=12",
          );

        if (active) {
          setStudents(
            response.data || [],
          );
        }
      } catch {
        if (active) {
          setStudents([]);
        }
      } finally {
        if (active) {
          setLoadingQuickLinks(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardShell
      title="Students"
      subtitle="Student master records, enrolments and family information"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-[1400px] space-y-5 pb-10">
        <section className="rounded-[30px] border border-[#dce5f0] bg-[#f7faff] p-6 shadow-[0_12px_34px_rgba(25,45,75,0.04)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/user-management"
                className="text-xs font-black uppercase tracking-[0.15em] text-[#2864e8] hover:text-[#1f57d0]"
              >
                ← People
              </Link>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2864e8]">
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

        <section className="rounded-[26px] border border-[#dfe7ef] bg-white p-5 shadow-[0_8px_28px_rgba(25,45,75,0.035)]">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#94a2b5]">
                Quick profile access
              </p>

              <h2 className="mt-1 text-lg font-black text-[#172033]">
                Open a student profile
              </h2>
            </div>

            <p className="text-xs text-[#8291a4]">
              Full profile includes academic and parent
              information.
            </p>
          </div>

          {loadingQuickLinks ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-2xl bg-[#f3f6fa]"
                  />
                ),
              )}
            </div>
          ) : students.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {students.map((student) => (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  className="group rounded-2xl border border-[#e1e7ee] bg-[#fbfcfe] p-4 transition hover:-translate-y-0.5 hover:border-[#cbd9ed] hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-[#1b2940]">
                        {student.firstName}{" "}
                        {student.lastName}
                      </p>

                      <p className="mt-1 truncate text-xs text-[#8291a4]">
                        {student.profile
                          ?.admissionNumber ||
                          student.email}
                      </p>
                    </div>

                    <span className="text-[#c2ccd8] transition group-hover:translate-x-1 group-hover:text-[#2864e8]">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-[#f7f9fc] p-5 text-sm text-[#77879b]">
              No student profiles are available yet.
              Use <strong>Add Student</strong> below to
              create the first record.
            </div>
          )}
        </section>

        <StudentManagement />
      </main>
    </DashboardShell>
  );
}
