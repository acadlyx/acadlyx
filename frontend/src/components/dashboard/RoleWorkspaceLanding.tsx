"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessNotice } from "@/components/dashboard/AccessNotice";
import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
} from "@/lib/auth";
import { CanonicalRole, hasAnyPermission, normalizeRoles } from "@/lib/authorization";

type Action = {
  label: string;
  href: string;
  description: string;
  permissions?: string[];
};

const META: Record<CanonicalRole, { title: string; subtitle: string; eyebrow: string; intro: string }> = {
  SUPER_ADMIN: { title: "Platform overview", subtitle: "Manage institutions and platform-level controls.", eyebrow: "Platform", intro: "Start with the institution or platform task you need to complete." },
  INSTITUTION_ADMIN: { title: "Institution overview", subtitle: "Keep your institution structure, people and academic setup organized.", eyebrow: "Administration", intro: "Everything here is focused on running your institution. Specialist approvals remain with their assigned teams." },
  CHAIRMAN: { title: "Leadership overview", subtitle: "See the institution at a strategic level.", eyebrow: "Leadership", intro: "Start with the information that helps you understand institutional performance." },
  DIRECTOR: { title: "Director overview", subtitle: "Monitor institution-wide academic and operational activity.", eyebrow: "Leadership", intro: "Use the overview first, then open only the operational area you need." },
  DEAN: { title: "School overview", subtitle: "Monitor your school or faculty without unrelated institution-wide controls.", eyebrow: "Academic leadership", intro: "Your workspace is scoped to the academic responsibility assigned to you." },
  REGISTRAR: { title: "Registrar overview", subtitle: "Manage official student records and academic lifecycle workflows.", eyebrow: "Academic records", intro: "Student records, registration and official documents are grouped together here." },
  HOD: { title: "Department overview", subtitle: "Run department-level academic operations and monitor your students.", eyebrow: "Department", intro: "Your tools are limited to the department responsibilities assigned to you." },
  FACULTY: { title: "Teaching overview", subtitle: "See your classes, attendance, assignments and assessment work.", eyebrow: "Teaching", intro: "Your most common teaching actions are one step away from this screen." },
  ACCOUNTS: { title: "Finance overview", subtitle: "Manage fees, payments, receipts and financial operations.", eyebrow: "Finance", intro: "Financial tools are grouped by the work you perform rather than by technical ERP modules." },
  HR: { title: "People overview", subtitle: "Manage employees and assigned leave workflows.", eyebrow: "People operations", intro: "Employee and leave work is kept together so you do not have to hunt through the system." },
  ADMISSIONS: { title: "Admissions overview", subtitle: "Move applications through the admission process.", eyebrow: "Admissions", intro: "Start with applications, then move through verification and admission steps." },
  EXAMINATION: { title: "Examination overview", subtitle: "Manage official examination and result workflows.", eyebrow: "Examination", intro: "Examination setup, processing and results are grouped into one clear workspace." },
  LIBRARIAN: { title: "Library overview", subtitle: "Run catalogue and circulation work from one place.", eyebrow: "Library", intro: "Open the library workspace for catalogue, circulation and member activity." },
  PLACEMENT: { title: "Placement overview", subtitle: "Manage career drives, applications and placement outcomes.", eyebrow: "Placement", intro: "Your placement workspace keeps company and student career work together." },
  IT: { title: "Technology overview", subtitle: "Handle technical operations and support workflows.", eyebrow: "Technology", intro: "Use the technology workspace for operational and support tasks only." },
  CMS: { title: "Website overview", subtitle: "Manage public website content and publishing.", eyebrow: "Content", intro: "CMS is isolated from academic, finance and HR operations." },
  STUDENT: { title: "My college", subtitle: "Your timetable, attendance, assignments, results and requests.", eyebrow: "Student", intro: "Start here. Your workspace shows only your own academic and student-service information." },
  PARENT: { title: "Family overview", subtitle: "Follow the academic information available for your linked children.", eyebrow: "Parent", intro: "Everything is organized around your linked children, not the wider institution." },
  CLUB_PRESIDENT: { title: "Club overview", subtitle: "Run your assigned student club within its own scope.", eyebrow: "Student club", intro: "Club President access is limited to the assigned club responsibility." },
};

const ACTIONS: Record<CanonicalRole, Action[]> = {
  SUPER_ADMIN: [{ label: "Open platform administration", href: "/superadmin", description: "Institutions, platform controls and designated administrators." }],
  INSTITUTION_ADMIN: [
    { label: "Manage people & users", href: "/admin", description: "Institution-level user and administration work.", permissions: ["users.read"] },
    { label: "Institution setup", href: "/institution-settings", description: "Institution settings and structure.", permissions: ["institutions.manage"] },
    { label: "Academic structure", href: "/erp", description: "Academic masters and institution setup.", permissions: ["academic-masters.read"] },
  ],
  CHAIRMAN: [
    { label: "View institution intelligence", href: "/intelligence", description: "Strategic academic and operational indicators.", permissions: ["intelligence.read"] },
    { label: "Open reports", href: "/reports", description: "Reports available to your authority.", permissions: ["reports.read"] },
  ],
  DIRECTOR: [
    { label: "View institution intelligence", href: "/intelligence", description: "Academic and operational performance.", permissions: ["intelligence.read"] },
    { label: "Review admissions", href: "/admissions", description: "Admission workflow where assigned.", permissions: ["admissions.read"] },
    { label: "Review examinations", href: "/examinations", description: "Examination information within your authority.", permissions: ["exams.read"] },
  ],
  DEAN: [
    { label: "View students", href: "/students", description: "Students inside your permitted school scope.", permissions: ["students.read"] },
    { label: "View academic intelligence", href: "/intelligence", description: "School-level academic indicators.", permissions: ["intelligence.read"] },
    { label: "Review examinations", href: "/examinations", description: "Examination information within your authority.", permissions: ["exams.read"] },
  ],
  REGISTRAR: [
    { label: "Manage enrollment", href: "/enrollment", description: "Official student enrollment and lifecycle workflows.", permissions: ["registration.read", "students.read"] },
    { label: "Course registration", href: "/course-registration", description: "Registration workflows.", permissions: ["registration.read"] },
    { label: "Certificates", href: "/certificates", description: "Official academic document workflows.", permissions: ["certificates.read"] },
  ],
  HOD: [
    { label: "Open department operations", href: "/erp", description: "Department-scoped academic operations.", permissions: ["academic-masters.read"] },
    { label: "View department students", href: "/students", description: "Students inside your department scope.", permissions: ["students.read"] },
    { label: "Review examinations", href: "/examinations", description: "Department examination workflows.", permissions: ["exams.read"] },
  ],
  FACULTY: [
    { label: "Open teaching workspace", href: "/faculty", description: "Your assigned classes and teaching activity." },
    { label: "Take attendance", href: "/faculty/attendance", description: "Attendance for assigned classes.", permissions: ["attendance.read"] },
    { label: "Manage assignments", href: "/faculty/assignments", description: "Assignments for your classes.", permissions: ["assignments.read"] },
    { label: "Enter marks", href: "/faculty/marks", description: "Assessment work for assigned courses.", permissions: ["marks.read"] },
  ],
  ACCOUNTS: [
    { label: "Open fees & billing", href: "/fees", description: "Collection, invoices, receipts and financial operations.", permissions: ["fees.read"] },
    { label: "Configure fees", href: "/erp?tab=fees", description: "Fee structures and billing setup.", permissions: ["fees.manage"] },
    { label: "View financial reports", href: "/reports", description: "Authorized financial reporting.", permissions: ["reports.read"] },
  ],
  HR: [
    { label: "Manage employees", href: "/hr", description: "Employee lifecycle and records.", permissions: ["hr.read"] },
    { label: "Process leave", href: "/leave-management", description: "Leave workflows assigned to HR.", permissions: ["leave.read"] },
  ],
  ADMISSIONS: [
    { label: "Review applications", href: "/applications", description: "Application review and processing.", permissions: ["admissions.read"] },
    { label: "Open admissions", href: "/admissions", description: "Admission workflow and onboarding.", permissions: ["admissions.read"] },
  ],
  EXAMINATION: [
    { label: "Manage examinations", href: "/examinations", description: "Official examination setup and processing.", permissions: ["exams.read"] },
    { label: "Process results", href: "/results", description: "Authorized result processing and publication.", permissions: ["results.read"] },
  ],
  LIBRARIAN: [{ label: "Open library", href: "/library", description: "Catalogue, circulation, reservations and fines.", permissions: ["library.read"] }],
  PLACEMENT: [
    { label: "Open placement operations", href: "/placements", description: "Companies, drives, applications and outcomes.", permissions: ["placement.read"] },
    { label: "View placement intelligence", href: "/intelligence", description: "Authorized placement analytics.", permissions: ["intelligence.read"] },
  ],
  IT: [{ label: "Open IT operations", href: "/operations", description: "Technical operations and support workflows.", permissions: ["operations.read"] }],
  CMS: [{ label: "Open website CMS", href: "/site-content", description: "Manage public website content.", permissions: ["site.manage"] }],
  STUDENT: [
    { label: "Open my academic dashboard", href: "/student", description: "Classes, progress and upcoming actions." },
    { label: "Check fees", href: "/fees", description: "Your own fee records and payments.", permissions: ["fees.read"] },
    { label: "View results", href: "/student/marks", description: "Your own marks and results.", permissions: ["marks.read"] },
    { label: "Check timetable", href: "/student/timetable", description: "Your enrolled classes.", permissions: ["timetable.read"] },
  ],
  PARENT: [{ label: "Open family dashboard", href: "/parent", description: "Your linked children's academic information." }],
  CLUB_PRESIDENT: [
    { label: "Open club workspace", href: "/club-president", description: "Activities within your assigned club scope.", permissions: ["club.read"] },
    { label: "Open club calendar", href: "/calendar", description: "Relevant institution and club events.", permissions: ["calendar.read"] },
  ],
};

function getPrimaryRole(roles: readonly string[]): CanonicalRole | null {
  const normalized = normalizeRoles(roles);
  const priority: CanonicalRole[] = [
    "SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "DIRECTOR", "DEAN", "REGISTRAR", "HOD",
    "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS", "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT",
    "CMS", "STUDENT", "PARENT", "CLUB_PRESIDENT",
  ];
  return priority.find((role) => normalized.includes(role)) ?? null;
}

export function RoleWorkspaceLanding({ role }: { role: CanonicalRole }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(getCachedCurrentUser());
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getCurrentUser({ background: Boolean(user) })
      .then((current) => {
        if (mounted) setUser(current);
      })
      .catch((err) => {
        if (!mounted) return;
        if (err instanceof AuthRequiredError) router.replace("/login");
        else setError("We could not load your workspace. Please try again.");
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  const currentRole = user ? getPrimaryRole(user.roles) : role;
  const meta = META[role];

  const actions = useMemo(() => {
    if (!user) return [];
    return ACTIONS[role].filter(
      (item) => !item.permissions?.length || hasAnyPermission(user, item.permissions),
    );
  }, [role, user]);

  if (currentRole && currentRole !== role) {
    return (
      <DashboardShell title="Workspace" allowedRoles={[role]}>
        <AccessNotice
          title="This workspace isn't assigned to you"
          message="Your account is active, but this workspace belongs to another responsibility. Your dashboard will only show the tools available to you."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={meta.title} subtitle={meta.subtitle} allowedRoles={[role]}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white sm:px-8 sm:py-8">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-300">{meta.eyebrow}</p>
            <h2 className="mt-2 max-w-3xl text-2xl font-black tracking-tight sm:text-3xl">Welcome{user?.firstName ? `, ${user.firstName}` : ""}.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{meta.intro}</p>
          </div>

          <div className="p-5 sm:p-7">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Start here</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">Your available work</h3>
              </div>
              <span className="hidden text-xs font-medium text-slate-400 sm:block">Only authorized tools are shown</span>
            </div>

            {actions.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {actions.map((item) => (
                  <Link
                    key={`${item.href}:${item.label}`}
                    href={item.href}
                    className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition group-hover:bg-slate-950 group-hover:text-white group-hover:ring-slate-950">
                        {item.label.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-950">{item.label}</h4>
                        <p className="mt-1.5 text-sm leading-5 text-slate-500">{item.description}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs font-bold text-slate-400 transition group-hover:text-slate-700">Open →</p>
                  </Link>
                ))}
              </div>
            ) : (
              <AccessNotice
                title="No workspace actions are assigned yet"
                message="Your account is active, but there are currently no actions assigned to this workspace. Ask your institution administrator to review your responsibilities."
                homeHref="/account-security"
                homeLabel="Open account settings"
              />
            )}
          </div>
        </section>

        {error ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {error}
          </p>
        ) : null}
      </div>
    </DashboardShell>
  );
}
