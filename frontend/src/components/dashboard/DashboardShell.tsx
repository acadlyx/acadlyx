"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";
import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";

import {
  hasAnyPermission,
  normalizeRole,
  normalizeRoles,
  type PermissionKey,
} from "@/lib/authorization";

/* -------------------------------------------------------------------------- */
/* Navigation types                                                           */
/* -------------------------------------------------------------------------- */

type NavItem = {
  label: string;
  href: string;
  icon: string;
  permissions?: readonly PermissionKey[];
};

/* -------------------------------------------------------------------------- */
/* Canonical role identity                                                    */
/* -------------------------------------------------------------------------- */

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  INSTITUTION_ADMIN: "Institution Admin",
  CHAIRMAN: "Chairman / Management",
  DIRECTOR: "Director",
  DEAN: "Dean",
  REGISTRAR: "Registrar",
  HOD: "Head of Department",
  FACULTY: "Faculty",
  ACCOUNTS: "Accounts",
  HR: "Human Resources",
  ADMISSIONS: "Admissions",
  EXAMINATION: "Examination Cell",
  LIBRARIAN: "Librarian",
  PLACEMENT: "Placement",
  IT: "IT Administration",
  CMS: "Website CMS",
  STUDENT: "Student",
  PARENT: "Parent",
  CLUB_PRESIDENT: "Club President",

  /* Legacy display aliases */
  MANAGEMENT: "Chairman / Management",
  STAFF: "Accounts",
};

/**
 * This priority is used ONLY when an account has multiple responsibilities.
 *
 * It does NOT merge permissions or navigation.
 *
 * The selected role determines the dashboard identity currently displayed.
 * Backend authorization remains independent and authoritative.
 */
const DASHBOARD_PRIORITY = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "MANAGEMENT",
  "DIRECTOR",
  "DEAN",
  "REGISTRAR",
  "HOD",
  "FACULTY",
  "ACCOUNTS",
  "STAFF",
  "HR",
  "ADMISSIONS",
  "EXAMINATION",
  "LIBRARIAN",
  "PLACEMENT",
  "IT",
  "CMS",
  "CLUB_PRESIDENT",
  "PARENT",
  "STUDENT",
] as const;

/* -------------------------------------------------------------------------- */
/* Navigation catalogue                                                       */
/* -------------------------------------------------------------------------- */

/**
 * IMPORTANT:
 *
 * This is a presentation/navigation catalogue.
 *
 * It does NOT grant permissions.
 *
 * Each operational item declares the capability required to expose it in
 * the UI. The backend independently enforces the same capability plus
 * institution/scope/workflow authority.
 *
 * Dashboard links themselves do not require a module permission.
 */

const roleNavigation: Record<string, NavItem[]> = {
  SUPER_ADMIN: [
    {
      label: "Dashboard",
      href: "/superadmin",
      icon: "⌂",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  INSTITUTION_ADMIN: [
    {
      label: "Dashboard",
      href: "/admin",
      icon: "⌂",
    },
    {
      label: "People & Users",
      href: "/admin",
      icon: "♙",
      permissions: ["users.read"],
    },
    {
      label: "ERP Operations",
      href: "/erp",
      icon: "▦",
      permissions: [
        "students.read",
        "fees.read",
        "departments.read",
        "programs.read",
      ],
    },
    {
      label: "Admissions",
      href: "/admissions",
      icon: "✎",
      permissions: ["admissions.read"],
    },
    {
      label: "HR",
      href: "/hr",
      icon: "♙",
      permissions: ["hr.read"],
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
      permissions: ["library.read"],
    },
    {
      label: "Academic Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Registrations",
      href: "/course-registration",
      icon: "⊞",
      permissions: ["registration.read"],
    },
    {
      label: "Student Movement",
      href: "/student-promotion",
      icon: "⇗",
      permissions: ["promotions.read"],
    },
    {
      label: "Certificates",
      href: "/certificates",
      icon: "❖",
      permissions: ["certificates.read"],
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
      permissions: ["results.read"],
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
      permissions: ["exams.read"],
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
      permissions: ["fees.read"],
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
      permissions: ["operations.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  CHAIRMAN: [
    {
      label: "Dashboard",
      href: "/management",
      icon: "⌂",
    },
    {
      label: "Institution Overview",
      href: "/management",
      icon: "▦",
    },
    {
      label: "Intelligence",
      href: "/intelligence",
      icon: "✦",
      permissions: ["intelligence.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Admissions",
      href: "/admissions",
      icon: "✎",
      permissions: ["admissions.read"],
    },
    {
      label: "Academic Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
      permissions: ["results.read"],
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
      permissions: ["fees.read"],
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
      permissions: ["operations.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  MANAGEMENT: [
    {
      label: "Dashboard",
      href: "/management",
      icon: "⌂",
    },
    {
      label: "Institution Overview",
      href: "/management",
      icon: "▦",
    },
    {
      label: "Intelligence",
      href: "/intelligence",
      icon: "✦",
      permissions: ["intelligence.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Admissions",
      href: "/admissions",
      icon: "✎",
      permissions: ["admissions.read"],
    },
    {
      label: "Academic Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
      permissions: ["results.read"],
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
      permissions: ["fees.read"],
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
      permissions: ["operations.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  DIRECTOR: [
    {
      label: "Dashboard",
      href: "/director",
      icon: "⌂",
    },
    {
      label: "ERP Operations",
      href: "/erp",
      icon: "▦",
      permissions: [
        "students.read",
        "departments.read",
        "programs.read",
      ],
    },
    {
      label: "Intelligence",
      href: "/intelligence",
      icon: "✦",
      permissions: ["intelligence.read"],
    },
    {
      label: "Admissions",
      href: "/admissions",
      icon: "✎",
      permissions: ["admissions.read"],
    },
    {
      label: "HR",
      href: "/hr",
      icon: "♙",
      permissions: ["hr.read"],
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
      permissions: ["library.read"],
    },
    {
      label: "Academic Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Registrations",
      href: "/course-registration",
      icon: "⊞",
      permissions: ["registration.read"],
    },
    {
      label: "Student Movement",
      href: "/student-promotion",
      icon: "⇗",
      permissions: ["promotions.read"],
    },
    {
      label: "Certificates",
      href: "/certificates",
      icon: "❖",
      permissions: ["certificates.read"],
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
      permissions: ["results.read"],
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
      permissions: ["exams.read"],
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
      permissions: ["fees.read"],
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
      permissions: ["operations.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  DEAN: [
    {
      label: "Dashboard",
      href: "/admin",
      icon: "⌂",
    },
    {
      label: "Students",
      href: "/students",
      icon: "♙",
      permissions: ["students.read"],
    },
    {
      label: "Academic Operations",
      href: "/erp",
      icon: "▦",
      permissions: [
        "departments.read",
        "programs.read",
        "courses.read",
      ],
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
      permissions: ["exams.read"],
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
      permissions: ["results.read"],
    },
    {
      label: "Registrations",
      href: "/course-registration",
      icon: "⊞",
      permissions: ["registration.read"],
    },
    {
      label: "Student Movement",
      href: "/student-promotion",
      icon: "⇗",
      permissions: ["promotions.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  REGISTRAR: [
    {
      label: "Dashboard",
      href: "/admin",
      icon: "⌂",
    },
    {
      label: "Students",
      href: "/students",
      icon: "♙",
      permissions: ["students.read"],
    },
    {
      label: "Enrollment",
      href: "/enrollment",
      icon: "⊞",
      permissions: ["registration.read"],
    },
    {
      label: "Registrations",
      href: "/course-registration",
      icon: "▦",
      permissions: ["registration.read"],
    },
    {
      label: "Student Movement",
      href: "/student-promotion",
      icon: "⇗",
      permissions: ["promotions.read"],
    },
    {
      label: "Certificates",
      href: "/certificates",
      icon: "❖",
      permissions: ["certificates.read"],
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
      permissions: ["results.read"],
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
      permissions: ["exams.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  HOD: [
    {
      label: "Dashboard",
      href: "/hod",
      icon: "⌂",
    },
    {
      label: "Students",
      href: "/students",
      icon: "♙",
      permissions: ["students.read"],
    },
    {
      label: "Academic Operations",
      href: "/erp",
      icon: "▦",
      permissions: [
        "departments.read",
        "programs.read",
        "courses.read",
        "course-offerings.read",
      ],
    },
    {
      label: "Attendance",
      href: "/faculty/attendance",
      icon: "◷",
      permissions: ["attendance.read"],
    },
    {
      label: "Marks",
      href: "/faculty/marks",
      icon: "◈",
      permissions: ["marks.read"],
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
      permissions: ["exams.read"],
    },
    {
      label: "Registrations",
      href: "/course-registration",
      icon: "⊞",
      permissions: ["registration.read"],
    },
    {
      label: "Student Movement",
      href: "/student-promotion",
      icon: "⇗",
      permissions: ["promotions.read"],
    },
    {
      label: "Leave",
      href: "/leave-management",
      icon: "⏻",
      permissions: ["leave.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  FACULTY: [
    {
      label: "Dashboard",
      href: "/faculty",
      icon: "⌂",
    },
    {
      label: "Attendance",
      href: "/faculty/attendance",
      icon: "◷",
      permissions: ["attendance.read"],
    },
    {
      label: "Assignments",
      href: "/faculty/assignments",
      icon: "✓",
      permissions: ["assignments.read"],
    },
    {
      label: "Marks",
      href: "/faculty/marks",
      icon: "◈",
      permissions: ["marks.read"],
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
      permissions: ["results.read"],
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
      permissions: ["exams.read"],
    },
    {
      label: "Course material",
      href: "/lms",
      icon: "▤",
      permissions: ["lms.read"],
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
      permissions: ["library.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Leave",
      href: "/leave-management",
      icon: "⏻",
      permissions: ["leave.read"],
    },
    {
      label: "Maintenance",
      href: "/operations",
      icon: "⚒",
      permissions: ["maintenance.raise"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  ACCOUNTS: [
    {
      label: "Dashboard",
      href: "/staff",
      icon: "⌂",
    },
    {
      label: "Fees & Billing",
      href: "/erp?tab=fees",
      icon: "₹",
      permissions: ["fees.read"],
    },
    {
      label: "Fee Collection",
      href: "/fees",
      icon: "▦",
      permissions: ["fees.read"],
    },
    {
      label: "Fee Receipts",
      href: "/fees/receipts",
      icon: "▤",
      permissions: ["fees.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▥",
      permissions: ["reports.read"],
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
      permissions: ["operations.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  STAFF: [
    {
      label: "Dashboard",
      href: "/staff",
      icon: "⌂",
    },
    {
      label: "Fees & Billing",
      href: "/erp?tab=fees",
      icon: "₹",
      permissions: ["fees.read"],
    },
    {
      label: "Fee Collection",
      href: "/fees",
      icon: "▦",
      permissions: ["fees.read"],
    },
    {
      label: "Fee Receipts",
      href: "/fees/receipts",
      icon: "▤",
      permissions: ["fees.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▥",
      permissions: ["reports.read"],
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
      permissions: ["operations.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  HR: [
    {
      label: "Dashboard",
      href: "/hr",
      icon: "⌂",
    },
    {
      label: "Employees",
      href: "/hr",
      icon: "♙",
      permissions: ["hr.read"],
    },
    {
      label: "Leave Management",
      href: "/leave-management",
      icon: "⏻",
      permissions: ["leave.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  ADMISSIONS: [
    {
      label: "Dashboard",
      href: "/admissions",
      icon: "⌂",
    },
    {
      label: "Applications",
      href: "/applications",
      icon: "✎",
      permissions: ["admissions.read"],
    },
    {
      label: "Student Records",
      href: "/students",
      icon: "♙",
      permissions: ["students.read"],
    },
    {
      label: "Admissions",
      href: "/admissions",
      icon: "▦",
      permissions: ["admissions.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  EXAMINATION: [
    {
      label: "Dashboard",
      href: "/examinations",
      icon: "⌂",
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
      permissions: ["exams.read"],
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
      permissions: ["results.read"],
    },
    {
      label: "Students",
      href: "/students",
      icon: "♙",
      permissions: ["students.read"],
    },
    {
      label: "Academic Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  LIBRARIAN: [
    {
      label: "Dashboard",
      href: "/library",
      icon: "⌂",
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
      permissions: ["library.read"],
    },
    {
      label: "Students",
      href: "/students",
      icon: "♙",
      permissions: ["students.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  PLACEMENT: [
    {
      label: "Dashboard",
      href: "/placements",
      icon: "⌂",
    },
    {
      label: "Placement",
      href: "/placements",
      icon: "◎",
      permissions: ["operations.read"],
    },
    {
      label: "Students",
      href: "/students",
      icon: "♙",
      permissions: ["students.read"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  IT: [
    {
      label: "Dashboard",
      href: "/operations",
      icon: "⌂",
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
      permissions: ["operations.read"],
    },
    {
      label: "Data Import",
      href: "/imports",
      icon: "⇅",
      permissions: ["imports.manage"],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: "▤",
      permissions: ["reports.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  CMS: [
    {
      label: "Website CMS",
      href: "/site-content",
      icon: "◫",
      permissions: ["site.manage"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  STUDENT: [
    {
      label: "Dashboard",
      href: "/student",
      icon: "⌂",
    },
    {
      label: "Timetable",
      href: "/student/timetable",
      icon: "▦",
      permissions: ["calendar.read"],
    },
    {
      label: "Academic dates",
      href: "/student/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Attendance",
      href: "/student/attendance",
      icon: "◷",
      permissions: ["attendance.read"],
    },
    {
      label: "Assignments",
      href: "/student/assignments",
      icon: "✓",
      permissions: ["assignments.read"],
    },
    {
      label: "Marks",
      href: "/student/marks",
      icon: "◈",
      permissions: ["marks.read"],
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
      permissions: ["results.read"],
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
      permissions: ["exams.read"],
    },
    {
      label: "Course material",
      href: "/lms",
      icon: "▤",
      permissions: ["lms.read"],
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
      permissions: ["fees.read"],
    },
    {
      label: "Course registration",
      href: "/course-registration",
      icon: "⊞",
      permissions: ["registration.read"],
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
      permissions: ["library.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Certificates",
      href: "/certificates",
      icon: "❖",
      permissions: ["certificates.read"],
    },
    {
      label: "Leave",
      href: "/leave-management",
      icon: "⏻",
      permissions: ["leave.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  PARENT: [
    {
      label: "Dashboard",
      href: "/parent",
      icon: "⌂",
    },
    {
      label: "My children",
      href: "/parent/children",
      icon: "♙",
      permissions: ["parent-portal.read"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
      permissions: ["fees.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  CLUB_PRESIDENT: [
    {
      label: "Dashboard",
      href: "/student",
      icon: "⌂",
    },
    {
      label: "Club Workspace",
      href: "/student",
      icon: "★",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
      permissions: ["calendar.read"],
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Role helpers                                                               */
/* -------------------------------------------------------------------------- */

function getPrimaryRole(
  roles: readonly string[]
): string {
  const normalized = normalizeRoles(roles);

  for (const role of DASHBOARD_PRIORITY) {
    const canonical = normalizeRole(role);

    if (normalized.includes(canonical)) {
      return canonical;
    }
  }

  return normalized[0] || "";
}

function getRoleHome(
  roles: readonly string[]
): string {
  const role = getPrimaryRole(roles);

  switch (role) {
    case "SUPER_ADMIN":
      return "/superadmin";

    case "INSTITUTION_ADMIN":
      return "/admin";

    case "CHAIRMAN":
      return "/management";

    case "DIRECTOR":
      return "/director";

    case "DEAN":
      return "/admin";

    case "REGISTRAR":
      return "/admin";

    case "HOD":
      return "/hod";

    case "FACULTY":
      return "/faculty";

    case "ACCOUNTS":
      return "/staff";

    case "HR":
      return "/hr";

    case "ADMISSIONS":
      return "/admissions";

    case "EXAMINATION":
      return "/examinations";

    case "LIBRARIAN":
      return "/library";

    case "PLACEMENT":
      return "/placements";

    case "IT":
      return "/operations";

    case "CMS":
      return "/site-content";

    case "STUDENT":
      return "/student";

    case "PARENT":
      return "/parent";

    case "CLUB_PRESIDENT":
      return "/student";

    default:
      return "/login";
  }
}

/* -------------------------------------------------------------------------- */
/* Permission filtering                                                       */
/* -------------------------------------------------------------------------- */

function canRenderNavItem(
  user: AuthUser | null,
  item: NavItem
): boolean {
  if (!item.permissions || item.permissions.length === 0) {
    return true;
  }

  return hasAnyPermission(
    user,
    item.permissions
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard shell                                                            */
/* -------------------------------------------------------------------------- */

export function DashboardShell({
  title,
  subtitle,
  children,
  allowedRoles,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  allowedRoles?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [collapsed, setCollapsed] =
    useState(false);

  const allowedRolesKey =
    allowedRoles?.join(",") || "";

  /* ---------------------------------------------------------------------- */
  /* Current dashboard identity                                             */
  /* ---------------------------------------------------------------------- */

  const currentRoles = useMemo(() => {
    if (user?.roles?.length) {
      return normalizeRoles(user.roles);
    }

    if (allowedRoles?.length) {
      return normalizeRoles(allowedRoles);
    }

    return [];
  }, [
    user?.roles,
    allowedRolesKey,
  ]);

  /**
   * IMPORTANT:
   *
   * Only ONE role navigation catalogue is selected.
   *
   * We intentionally do NOT merge:
   *
   *   Faculty + HOD + Accounts
   *
   * into one giant menu.
   *
   * Multiple responsibilities are handled by the permission/scope layer
   * and dedicated workflows, not by blindly combining dashboards.
   */
  const primaryRole = useMemo(
    () => getPrimaryRole(currentRoles),
    [currentRoles]
  );

  const navItems = useMemo(() => {
    const roleItems =
      roleNavigation[primaryRole] || [];

    const seen = new Set<string>();

    return roleItems.filter((item) => {
      const key =
        `${item.href}:${item.label}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return canRenderNavItem(
        user,
        item
      );
    });
  }, [
    primaryRole,
    user,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Authentication / route guard                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    const cachedUser =
      getCachedCurrentUser();

    if (cachedUser) {
      const normalizedCachedRoles =
        normalizeRoles(
          cachedUser.roles
        );

      if (
        allowedRoles &&
        allowedRoles.length > 0 &&
        !allowedRoles.some((role) =>
          normalizedCachedRoles.includes(
            normalizeRole(role)
          )
        )
      ) {
        router.replace(
          getRoleHome(
            normalizedCachedRoles
          )
        );

        return () => {
          mounted = false;
        };
      }

      /*
       * Render immediately from the trusted tab-local snapshot.
       * getCurrentUser() still revalidates the session in the background.
       */
      setUser(cachedUser);
    }

    getCurrentUser({
      background: Boolean(cachedUser),
    })
      .then((currentUser) => {
        if (!mounted) {
          return;
        }

        const normalizedRoles =
          normalizeRoles(
            currentUser.roles
          );

        if (
          allowedRoles &&
          allowedRoles.length > 0 &&
          !allowedRoles.some((role) =>
            normalizedRoles.includes(
              normalizeRole(role)
            )
          )
        ) {
          router.replace(
            getRoleHome(
              normalizedRoles
            )
          );

          return;
        }

        setUser(currentUser);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        if (
          error instanceof AuthRequiredError
        ) {
          router.replace("/login");
        }
      });

    return () => {
      mounted = false;
    };
  }, [
    router,
    allowedRolesKey,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Navigation lifecycle                                                    */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    /*
     * Next.js already prefetches visible Links.
     *
     * This additional idle prefetch is retained from the production
     * performance work, but now operates only on the active dashboard's
     * authorized navigation.
     */
    const warmRoutes = () => {
      for (const item of navItems) {
        router.prefetch(item.href);
      }
    };

    const idle =
      window.setTimeout(
        warmRoutes,
        40
      );

    return () =>
      window.clearTimeout(idle);
  }, [
    navItems,
    router,
  ]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [mobileOpen]);

  /* ---------------------------------------------------------------------- */
  /* Actions                                                                 */
  /* ---------------------------------------------------------------------- */

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  function isActive(
    item: NavItem
  ): boolean {
    /*
     * Exact dashboard routes should not become active merely because
     * another route happens to share their prefix.
     */
    if (
      item.href === "/student" ||
      item.href === "/faculty" ||
      item.href === "/parent" ||
      item.href === "/management" ||
      item.href === "/director" ||
      item.href === "/hod" ||
      item.href === "/admin" ||
      item.href === "/superadmin"
    ) {
      if (
        pathname === item.href
      ) {
        return true;
      }

      if (
        item.href === "/student" &&
        pathname.startsWith("/student/")
      ) {
        return true;
      }

      if (
        item.href === "/faculty" &&
        pathname.startsWith("/faculty/")
      ) {
        return true;
      }

      if (
        item.href === "/parent" &&
        pathname.startsWith("/parent/")
      ) {
        return true;
      }

      return false;
    }

    const cleanHref =
      item.href.split("?")[0];

    return (
      pathname === cleanHref ||
      pathname.startsWith(
        `${cleanHref}/`
      )
    );
  }

  const displayRole =
    ROLE_LABELS[primaryRole] ||
    primaryRole
      .replace(/_/g, " ")
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase()
      );

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      {/* ---------------------------------------------------------------- */}
      {/* Top header                                                        */}
      {/* ---------------------------------------------------------------- */}

      <header className="fixed inset-x-0 top-0 z-50 h-[72px] border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6">
          {/* Mobile navigation */}
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={
              mobileOpen
            }
            onClick={() =>
              setMobileOpen(
                (value) =>
                  !value
              )
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
          >
            {mobileOpen ? (
              <span className="text-xl leading-none">
                ×
              </span>
            ) : (
              <span className="flex flex-col gap-1.5">
                <span className="h-0.5 w-5 rounded-full bg-slate-700" />
                <span className="h-0.5 w-5 rounded-full bg-slate-700" />
                <span className="h-0.5 w-5 rounded-full bg-slate-700" />
              </span>
            )}
          </button>

          {/* Desktop sidebar toggle */}
          <button
            type="button"
            aria-label={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            onClick={() =>
              setCollapsed(
                (value) =>
                  !value
              )
            }
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 lg:flex"
          >
            <span className="text-lg font-medium">
              {collapsed
                ? "›"
                : "‹"}
            </span>
          </button>

          {/* Brand */}
          <Link
            href={getRoleHome(
              currentRoles
            )}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-950">
              <Image
                src="/branding/acadlyx-logo.png"
                alt="ACADLYX"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                priority
              />
            </div>

            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-extrabold tracking-tight text-slate-950">
                ACADLYX
              </p>

              <p className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Institutional intelligence
              </p>
            </div>
          </Link>

          {/* Divider */}
          <div className="ml-3 hidden min-w-0 md:block">
            <div className="h-6 w-px bg-slate-200" />
          </div>

          {/* Current page */}
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-bold text-slate-900">
              {title}
            </p>

            {subtitle && (
              <p className="max-w-[500px] truncate text-xs text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          {/* Account */}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right xl:block">
              <p className="text-xs font-bold text-slate-800">
                {user
                  ? `${user.firstName} ${user.lastName}`
                  : "Loading…"}
              </p>

              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {displayRole}
              </p>
            </div>

            <AccountMenu />

            <button
              type="button"
              onClick={signOut}
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:block"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Mobile overlay                                                    */}
      {/* ---------------------------------------------------------------- */}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() =>
            setMobileOpen(false)
          }
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Sidebar                                                           */}
      {/* ---------------------------------------------------------------- */}

      <aside
        className={[
          "fixed bottom-0 left-0 top-[72px] z-40",
          "border-r border-slate-200/80",
          "bg-white",
          "transition-all duration-200",
          "lg:translate-x-0",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full",
          collapsed
            ? "lg:w-[82px]"
            : "w-[270px] lg:w-[250px]",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-y-auto p-3">
          {/* Workspace identity */}
          <div
            className={`mb-5 rounded-2xl border border-slate-100 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-3 ${
              collapsed
                ? "lg:p-2"
                : ""
            }`}
          >
            <div
              className={`flex items-center gap-3 ${
                collapsed
                  ? "lg:justify-center"
                  : ""
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 text-sm font-black text-white">
                {primaryRole
                  ? primaryRole
                      .charAt(0)
                      .toUpperCase()
                  : "A"}
              </div>

              <div
                className={
                  collapsed
                    ? "lg:hidden"
                    : ""
                }
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Workspace
                </p>

                <p className="mt-0.5 truncate text-xs font-bold text-slate-800">
                  {displayRole ||
                    "ACADLYX"}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav
            aria-label="Dashboard navigation"
            className="space-y-1"
          >
            {navItems.map(
              (item) => {
                const active =
                  isActive(item);

                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={
                      item.href
                    }
                    title={
                      collapsed
                        ? item.label
                        : undefined
                    }
                    onClick={() =>
                      setMobileOpen(
                        false
                      )
                    }
                    className={[
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5",
                      "text-sm font-semibold transition-all",
                      collapsed
                        ? "lg:justify-center lg:px-2"
                        : "",
                      active
                        ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-white",
                      ].join(" ")}
                    >
                      {item.icon}
                    </span>

                    <span
                      className={
                        collapsed
                          ? "lg:hidden"
                          : ""
                      }
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              }
            )}
          </nav>

          {/* Empty-state guard */}
          {navItems.length === 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-900">
                No available modules
              </p>

              <p className="mt-1 text-[11px] leading-5 text-amber-700">
                Your account does not currently have
                an enabled workspace capability.
              </p>
            </div>
          )}

          {/* Bottom identity card */}
          <div
            className={`mt-auto pt-5 ${
              collapsed
                ? "lg:hidden"
                : ""
            }`}
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold text-slate-900">
                ACADLYX
              </p>

              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Education ERP &
                institutional
                intelligence
                platform.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* Main content                                                      */}
      {/* ---------------------------------------------------------------- */}

      <main
        className={[
          "min-h-screen pt-[72px] transition-[padding] duration-200",
          collapsed
            ? "lg:pl-[82px]"
            : "lg:pl-[250px]",
        ].join(" ")}
      >
        <div className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
