"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { AuthRequiredError, AuthUser, getCurrentUser, logout } from "@/lib/auth";
import {
  activeNavigationHref,
  canAccessWorkspace,
  navigationForUser,
  primaryRole,
  ROLE_LABELS,
  workspaceHome,
} from "@/lib/navigation";

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
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const allowedRolesKey = allowedRoles?.join(",") || "";

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        if (!canAccessWorkspace(currentUser, allowedRoles)) {
          router.replace(workspaceHome(currentUser.roles));
          return;
        }
        setUser(currentUser);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof AuthRequiredError) router.replace("/login");
      });

    return () => {
      active = false;
    };
  }, [router, allowedRolesKey]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navigation = useMemo(() => user ? navigationForUser(user) : [], [user]);
  const activeHref = useMemo(() => activeNavigationHref(pathname, navigation), [pathname, navigation]);
  const role = primaryRole(user?.roles || allowedRoles || []);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center border-b border-slate-200 bg-white px-4 lg:px-6">
        <button type="button" aria-label="Toggle navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)} className="mr-3 grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 lg:hidden">
          {mobileOpen ? "×" : "☰"}
        </button>
        <button type="button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setCollapsed((value) => !value)} className="mr-3 hidden h-9 w-9 rounded-md border border-slate-200 text-slate-600 lg:block">
          {collapsed ? "›" : "‹"}
        </button>
        <Link href={workspaceHome(user?.roles || allowedRoles || [])} className="flex items-center gap-2.5">
          <Image src="/branding/acadlyx-logo.png" alt="ACADLYX" width={34} height={34} className="h-8 w-8 object-contain" priority />
          <span className="text-sm font-bold tracking-wide text-slate-900">ACADLYX</span>
        </Link>
        <div className="ml-5 hidden min-w-0 border-l border-slate-200 pl-5 md:block">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-slate-800">{user ? `${user.firstName} ${user.lastName}` : ""}</p><p className="text-[11px] text-slate-500">{ROLE_LABELS[role] || role.replace(/_/g, " ")}</p></div>
          <AccountMenu />
          <button type="button" onClick={signOut} className="hidden rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:block">Sign out</button>
        </div>
      </header>

      {mobileOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />}

      <aside className={`fixed bottom-0 left-0 top-16 z-40 border-r border-slate-200 bg-white transition-[width,transform] duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "lg:w-16" : "w-64 lg:w-60"}`}>
        <div className="flex h-full flex-col p-3">
          <div className={`mb-4 border-b border-slate-100 pb-3 ${collapsed ? "lg:text-center" : ""}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-widest text-slate-400 ${collapsed ? "lg:hidden" : ""}`}>Workspace</p>
            <p className={`mt-1 text-sm font-semibold text-slate-700 ${collapsed ? "lg:hidden" : ""}`}>{ROLE_LABELS[role] || "ACADLYX"}</p>
            {collapsed && <span className="hidden text-sm font-bold text-indigo-600 lg:block">{role.charAt(0)}</span>}
          </div>
          <nav aria-label="Workspace navigation" className="space-y-1">
            {navigation.map((item) => {
              const active = item.href === activeHref;
              return <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${collapsed ? "lg:justify-center lg:px-2" : ""} ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}><span className={`grid h-6 w-6 place-items-center text-sm ${active ? "text-indigo-600" : "text-slate-400"}`}>{item.icon}</span><span className={collapsed ? "lg:hidden" : ""}>{item.label}</span></Link>;
            })}
          </nav>
        </div>
      </aside>

      <main className={`min-h-screen pt-16 transition-[padding] duration-200 ${collapsed ? "lg:pl-16" : "lg:pl-60"}`}>
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
