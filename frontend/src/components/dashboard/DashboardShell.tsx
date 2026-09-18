"use client";

import Image from "next/image";
import Link from "next/link";
import {
usePathname,
useRouter,
} from "next/navigation";
import {
ReactNode,
useEffect,
useState,
} from "react";
import {
AuthRequiredError,
AuthUser,
getCurrentUser,
logout,
} from "@/lib/auth";

const nav = [
["Overview", ""],
["ERP Operations", "/erp"],
["Intelligence", "/intelligence"],
[
"Students & Academics",
"/admin",
],
["Placements", "/placements"],
["Imports", "/imports"],
["Website CMS", "/site-content"],
] as const;

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
useState<AuthUser | null>(
null
);

const [open, setOpen] =
useState(false);

useEffect(() => {
getCurrentUser()
.then((currentUser) => {
if (
allowedRoles &&
!currentUser.roles.some(
(role) =>
allowedRoles.includes(role)
)
) {
router.replace("/login");
return;
}

    setUser(currentUser);
  })
  .catch((error) => {
    if (
      error instanceof
      AuthRequiredError
    ) {
      router.replace("/login");
    }
  });

}, [
router,
allowedRoles?.join(","),
]);

async function signOut() {
await logout();
router.replace("/login");
}

const canManage =
user?.roles.some((role) =>
[
"SUPER_ADMIN",
"INSTITUTION_ADMIN",
"DIRECTOR",
"MANAGEMENT",
"STAFF",
].includes(role)
);

const filteredNav =
nav
.filter(
([label]) =>
label !==
"Website CMS" ||
canManage
)
.filter(
([label]) =>
label !==
"Imports" ||
canManage
);

return (
<div className="min-h-screen bg-slate-50 text-slate-900">
<header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
<div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
<div className="flex items-center gap-3">
<Image src="/branding/aimt-logo.png" alt="AIMT" width={42} height={42} className="h-10 w-10 object-contain" priority />

        <div className="hidden h-8 w-px bg-slate-200 sm:block" />

        <Image
          src="/branding/acadlyx-logo.png"
          alt="ACADLYX"
          width={38}
          height={38}
          className="h-9 w-9 rounded-lg object-contain"
          priority
        />

        <div className="ml-1">
          <p className="text-sm font-bold tracking-tight">
            ACADLYX
          </p>

          <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
            AIMT
          </p>
        </div>
      </div>

      <div className="hidden text-center sm:block">
        <p className="text-sm font-semibold">
          {title}
        </p>

        <p className="text-xs text-slate-400">
          {subtitle ||
            "Institutional workspace"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden text-right md:block">
          <p className="text-xs font-semibold">
            {user
              ? `${user.firstName} ${user.lastName}`
              : "Loading…"}
          </p>

          <p className="text-[10px] text-slate-400">
            {user?.roles?.[0]
              ?.replace(
                /_/g,
                " "
              ) || ""}
          </p>
        </div>

        <button
          onClick={signOut}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </div>
  </header>

  <div className="mx-auto flex max-w-[1500px]">
    <aside
      className={`${
        open
          ? "block"
          : "hidden"
      } fixed inset-y-16 left-0 z-30 w-64 border-r border-slate-200 bg-white p-3 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:self-start`}
    >
      <nav className="space-y-1">
        {filteredNav.map(
          ([label, href]) => {
            const active =
              href &&
              pathname.startsWith(
                href
              );

            const target =
              href ||
              pathname;

            return (
              <Link
                key={label}
                href={target}
                onClick={() =>
                  setOpen(
                    false
                  )
                }
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </Link>
            );
          }
        )}
      </nav>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-900">
          AIMT × ACADLYX
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Connected academic
          operations,
          intelligence and
          career readiness.
        </p>
      </div>
    </aside>

    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
      <button
        className="mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold lg:hidden"
        onClick={() =>
          setOpen(
            (value) => !value
          )
        }
      >
        Menu
      </button>

      {children}
    </main>
  </div>
</div>

);
}
