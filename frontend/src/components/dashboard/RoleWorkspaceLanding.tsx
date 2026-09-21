"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
} from "@/lib/auth";
import { CanonicalRole, hasAnyPermission, normalizeRole } from "@/lib/authorization";

type WorkspaceLink = {
  label: string;
  href: string;
  description: string;
  permissions?: string[];
};

const WORKSPACE_META: Record<CanonicalRole, { title: string; subtitle: string; eyebrow: string }> = {
  SUPER_ADMIN: { title: "Super Admin Workspace", subtitle: "Platform administration and tenant control", eyebrow: "Platform workspace" },
  INSTITUTION_ADMIN: { title: "Institution Admin Workspace", subtitle: "Institution configuration and administration", eyebrow: "Institution administration" },
  CHAIRMAN: { title: "Chairman Workspace", subtitle: "Executive oversight and institutional intelligence", eyebrow: "Executive workspace" },
  DIRECTOR: { title: "Director Workspace", subtitle: "Institution-wide academic and operational oversight", eyebrow: "Leadership workspace" },
  DEAN: { title: "Dean Workspace", subtitle: "School-level academic leadership and performance", eyebrow: "Academic leadership" },
  REGISTRAR: { title: "Registrar Workspace", subtitle: "Official student, registration and academic records", eyebrow: "Academic records" },
  HOD: { title: "HOD Workspace", subtitle: "Department operations, faculty and student performance", eyebrow: "Department workspace" },
  FACULTY: { title: "Faculty Workspace", subtitle: "Teaching, attendance, assessment and assigned classes", eyebrow: "Teaching workspace" },
  ACCOUNTS: { title: "Accounts Workspace", subtitle: "Fees, payments, receipts and financial operations", eyebrow: "Finance workspace" },
  HR: { title: "HR Workspace", subtitle: "Employee lifecycle, leave administration and HR operations", eyebrow: "People operations" },
  ADMISSIONS: { title: "Admissions Workspace", subtitle: "Applications, verification and admission workflow", eyebrow: "Admissions workspace" },
  EXAMINATION: { title: "Examination Cell Workspace", subtitle: "Examinations, eligibility, marks and result processing", eyebrow: "Examination workspace" },
  LIBRARIAN: { title: "Librarian Workspace", subtitle: "Library catalogue, circulation, reservations and fines", eyebrow: "Library workspace" },
  PLACEMENT: { title: "Placement Workspace", subtitle: "Companies, drives, applications and placement outcomes", eyebrow: "Career workspace" },
  IT: { title: "IT Workspace", subtitle: "Technical administration, integrations and operational support", eyebrow: "Technology workspace" },
  CMS: { title: "CMS Workspace", subtitle: "Public website content and publishing", eyebrow: "Content workspace" },
  STUDENT: { title: "Student Workspace", subtitle: "Your academic information and self-service actions", eyebrow: "Student workspace" },
  PARENT: { title: "Parent Workspace", subtitle: "Linked-child academic information and communication", eyebrow: "Parent workspace" },
  CLUB_PRESIDENT: { title: "Club President Workspace", subtitle: "Student-led club activities, members and events", eyebrow: "Club workspace" },
};

const LINKS: Record<CanonicalRole, WorkspaceLink[]> = {
  SUPER_ADMIN: [{ label: "Platform administration", href: "/superadmin", description: "Manage platform-level institutions and designated administrators." }],
  INSTITUTION_ADMIN: [{ label: "Institution administration", href: "/admin", description: "Manage institution-level configuration and administration." }],
  CHAIRMAN: [
    { label: "Institution intelligence", href: "/intelligence", description: "Review institution-wide performance and strategic indicators.", permissions: ["intelligence.read", "reports.read"] },
    { label: "Reports", href: "/reports", description: "Review institution reports available to your authority.", permissions: ["reports.read"] },
  ],
  DIRECTOR: [
    { label: "Institution intelligence", href: "/intelligence", description: "Review academic and operational performance.", permissions: ["intelligence.read", "reports.read"] },
    { label: "Admissions", href: "/admissions", description: "Review admission workflow where authorized.", permissions: ["admissions.read"] },
    { label: "Academic operations", href: "/erp", description: "Open authorized institutional ERP operations.", permissions: ["students.read", "academic-masters.read", "fees.read"] },
  ],
  DEAN: [
    { label: "Academic intelligence", href: "/intelligence", description: "Review school-level academic indicators.", permissions: ["intelligence.read", "reports.read"] },
    { label: "Student administration", href: "/students", description: "Open students within your permitted school scope.", permissions: ["students.read"] },
    { label: "Examinations", href: "/examinations", description: "Review examination information within your authority.", permissions: ["exams.read", "results.read"] },
  ],
  REGISTRAR: [
    { label: "Enrollment", href: "/enrollment", description: "Manage authorized enrollment and academic lifecycle workflows.", permissions: ["registration.manage", "students.manage"] },
    { label: "Course registration", href: "/course-registration", description: "Review registration workflows.", permissions: ["registration.read", "registration.manage"] },
    { label: "Certificates", href: "/certificates", description: "Manage authorized academic record and certificate workflows.", permissions: ["certificates.read", "certificates.manage"] },
  ],
  HOD: [
    { label: "Department operations", href: "/erp", description: "Open department-scoped ERP operations.", permissions: ["students.read", "academic-masters.read", "timetable.read"] },
    { label: "Examinations", href: "/examinations", description: "Review departmental examination workflows.", permissions: ["exams.read", "marks.read", "results.read"] },
    { label: "Student movement", href: "/student-promotion", description: "Open authorized student movement workflows.", permissions: ["promotions.read", "promotions.manage"] },
  ],
  FACULTY: [
    { label: "Teaching dashboard", href: "/faculty", description: "Open assigned teaching, attendance and learner information." },
    { label: "Examinations", href: "/examinations", description: "Open examination tasks assigned to you.", permissions: ["exams.read", "marks.read"] },
    { label: "Calendar", href: "/calendar", description: "View academic events and schedules.", permissions: ["calendar.read"] },
  ],
  ACCOUNTS: [
    { label: "Fees & billing", href: "/fees", description: "Open authorized fee collection and financial operations.", permissions: ["fees.read", "fees.manage", "fees.pay"] },
    { label: "ERP finance", href: "/erp?tab=fees", description: "Configure authorized fee structures and billing.", permissions: ["fees.manage"] },
    { label: "Reports", href: "/reports", description: "Review authorized financial reports.", permissions: ["reports.read"] },
  ],
  HR: [
    { label: "Employees", href: "/hr", description: "Manage authorized employee lifecycle operations.", permissions: ["hr.read", "hr.manage"] },
    { label: "Leave management", href: "/leave-management", description: "Process leave workflows assigned to HR authority.", permissions: ["leave.read", "leave.manage"] },
  ],
  ADMISSIONS: [
    { label: "Applications", href: "/applications", description: "Review and process admission applications.", permissions: ["admissions.read", "admissions.manage"] },
    { label: "Admissions", href: "/admissions", description: "Open the admission workflow.", permissions: ["admissions.read", "admissions.manage"] },
  ],
  EXAMINATION: [
    { label: "Examinations", href: "/examinations", description: "Manage examination setup and official processing.", permissions: ["exams.read", "exams.manage"] },
    { label: "Results", href: "/results", description: "Process and publish authorized results.", permissions: ["results.read", "results.manage"] },
  ],
  LIBRARIAN: [{ label: "Library", href: "/library", description: "Manage catalogue, circulation, reservations and fines.", permissions: ["library.read", "library.manage", "library.borrow"] }],
  PLACEMENT: [
    { label: "Placement operations", href: "/placements", description: "Open placement workflows.", permissions: ["placement.read", "placement.manage"] },
    { label: "Intelligence", href: "/intelligence", description: "Review authorized placement and outcome analytics.", permissions: ["intelligence.read", "reports.read"] },
  ],
  IT: [
    { label: "Operations", href: "/operations", description: "Review technical operations and support workflows.", permissions: ["operations.read", "operations.manage", "maintenance.read", "maintenance.manage"] },
    { label: "Account security", href: "/account-security", description: "Manage your account security settings." },
  ],
  CMS: [{ label: "Website CMS", href: "/site-content", description: "Manage public website content within CMS authority.", permissions: ["site.manage"] }],
  STUDENT: [
    { label: "Student portal", href: "/student", description: "Open your academic dashboard." },
    { label: "Fees", href: "/fees", description: "View your own financial records.", permissions: ["fees.read", "fees.pay"] },
    { label: "Examinations", href: "/examinations", description: "View your examination information.", permissions: ["exams.read", "results.read"] },
  ],
  PARENT: [{ label: "Parent portal", href: "/parent", description: "View information for your linked children." }],
  CLUB_PRESIDENT: [
    { label: "Club workspace", href: "/club-president", description: "Manage activities within your assigned club scope.", permissions: ["club.read", "club.manage"] },
    { label: "Calendar", href: "/calendar", description: "View relevant institution and club events.", permissions: ["calendar.read"] },
  ],
};

function primaryRole(roles: string[]): CanonicalRole | null {
  const priority: CanonicalRole[] = [
    "SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "DIRECTOR", "DEAN", "REGISTRAR", "HOD",
    "ACCOUNTS", "HR", "ADMISSIONS", "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "FACULTY",
    "STUDENT", "PARENT", "CLUB_PRESIDENT",
  ];
  const normalized = roles.map(normalizeRole);
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
        else setError(err instanceof Error ? err.message : "Unable to load workspace");
      });
    return () => { mounted = false; };
  }, [router]);

  const visibleLinks = useMemo(() => {
    if (!user) return [];
    return LINKS[role].filter((item) => !item.permissions?.length || hasAnyPermission(user, item.permissions));
  }, [role, user]);

  const meta = WORKSPACE_META[role];
  const currentRole = user ? primaryRole(user.roles) : role;

  if (currentRole && currentRole !== role) {
    return null;
  }

  return (
    <DashboardShell title={meta.title} subtitle={meta.subtitle} allowedRoles={[role]}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">{meta.eyebrow}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{meta.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{meta.subtitle}</p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleLinks.map((item) => (
              <Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-slate-900">{item.label}</h2>
                    <p className="mt-2 text-sm leading-5 text-slate-500">{item.description}</p>
                  </div>
                  <span className="text-slate-400 transition group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </DashboardShell>
  );
}
