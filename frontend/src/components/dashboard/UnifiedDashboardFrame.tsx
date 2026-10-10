"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isNavigationItemActive } from "@/lib/navigation";

export type DashboardNavigationItem = { id?: string; label: string; href: string; icon?: string; group?: string; badge?: string | number; children?: DashboardNavigationItem[]; disabled?: boolean; activeMatch?: "exact" | "nested"; activeQuery?: Record<string, string | null> };

const ICONS: Record<string, string> = {
  dashboard: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  people: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 11a3 3 0 1 0 0-6",
  student: "M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  organization: "M4 20V7l8-4 8 4v13M8 20v-5h8v5M8 9h1M12 9h1M16 9h1",
  academic: "M3 7.5 12 3l9 4.5-9 4.5-9-4.5ZM6 10.5V17c3.5 2.5 8.5 2.5 12 0v-6.5",
  calendar: "M5 4v3M19 4v3M4 8.5h16M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12.5A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5V6a2.5 2.5 0 0 1 2.5-2.5",
  book: "M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5M5 4.5v17M5 19h15",
  schedule: "M4 6h16v14H4zM8 3v6M16 3v6M4 10h16M8 14h3M14 14h2M8 17h2",
  building: "M4 21V4h10v17M14 9h6v12M7 8h3M7 12h3M7 16h3M17 13h1M17 17h1",
  notice: "M4 5h16v11H8l-4 4V5ZM8 9h8M8 12h5",
  bell: "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  import: "M12 3v12M7 10l5 5 5-5M5 21h14",
  document: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6",
  settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12l2-2-2-3-2.4 1a8 8 0 0 0-2-1.2L14 3h-4l-.3 2.8a8 8 0 0 0-2 1.2l-2.4-1-2 3 2 2",
  shield: "M12 3 19 6v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6zM9 12l2 2 4-4",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  logout: "M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5",
  menu: "M4 7h16M4 12h16M4 17h16",
  chevron: "m9 18 6-6-6-6",
};

function iconKey(item: DashboardNavigationItem) {
  const text = `${item.label} ${item.icon || ""}`.toLowerCase();
  if (/overview|dashboard|platform/.test(text)) return "dashboard";
  if (/user|people|parent|section|faculty|staff/.test(text)) return "people";
  if (/student/.test(text)) return "student";
  if (/department|organization|structure/.test(text)) return "organization";
  if (/program|semester|academic|obe|registration/.test(text)) return "academic";
  if (/year|calendar|timetable/.test(text)) return "calendar";
  if (/course|book|library|learning/.test(text)) return "book";
  if (/offering|schedule/.test(text)) return "schedule";
  if (/campus|institution|building/.test(text)) return "building";
  if (/notice|announcement/.test(text)) return "notice";
  if (/notification|bell/.test(text)) return "bell";
  if (/import|export|transfer/.test(text)) return "import";
  if (/document|certificate|report/.test(text)) return "document";
  if (/security|permission|audit|access/.test(text)) return "shield";
  if (/setting|operation|maintenance/.test(text)) return "settings";
  return "document";
}

export function SvgIcon({ name, className = "h-[18px] w-[18px]" }: { name?: string; className?: string }) {
  const path = ICONS[name || "document"] || ICONS.document;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={path} /></svg>;
}

function routeIsActive(pathname: string, item: DashboardNavigationItem) {
  return isNavigationItemActive(pathname, item);
}

function flatten(items: DashboardNavigationItem[]): DashboardNavigationItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flatten(item.children) : [])]);
}

function Brand({ logoUrl, institutionLogoUrl, collapsed }: { logoUrl?: string | null; institutionLogoUrl?: string | null; collapsed: boolean }) {
  return <div className={collapsed ? "flex justify-center" : "flex items-center gap-2.5"}>
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">{logoUrl ? <img src={logoUrl} alt="ACADLYX logo" className="h-full w-full object-contain" /> : <span className="font-black text-blue-600">A</span>}</div>
    {!collapsed && <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">{institutionLogoUrl ? <img src={institutionLogoUrl} alt="Institution logo" className="h-full w-full object-contain" /> : <span className="text-[10px] font-black text-slate-500">IN</span>}</div>}
  </div>;
}

function NavigationLink({ item, pathname, collapsed, onNavigate }: { item: DashboardNavigationItem; pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  const active = routeIsActive(pathname, item);
  return <Link href={item.disabled ? pathname : item.href} aria-current={active ? "page" : undefined} aria-disabled={item.disabled || undefined} title={collapsed ? item.label : undefined} onClick={(event) => { if (item.disabled) event.preventDefault(); else onNavigate?.(); }} data-active={active} data-disabled={item.disabled || undefined} className="acadlyx-sidebar-item group flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold">
    <span className="acadlyx-sidebar-icon grid h-9 w-9 shrink-0 place-items-center rounded-lg"><SvgIcon name={iconKey(item)} /></span>
    {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
    {!collapsed && item.badge !== undefined && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white">{item.badge}</span>}
  </Link>;
}

export function UnifiedDashboardFrame({ children, navigation = [], title, subtitle, userName, userRole, institutionName, logoUrl, institutionLogoUrl, onSignOut }: { children: ReactNode; navigation?: DashboardNavigationItem[]; title?: string; subtitle?: string; userName?: string; userRole?: string; userEmail?: string; institutionName?: string; logoUrl?: string | null; institutionLogoUrl?: string | null; onSignOut?: () => void | Promise<void> }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, DashboardNavigationItem[]>();
    flatten(navigation).forEach((item) => { if (item.children?.length) return; const group = item.group || "Workspace"; map.set(group, [...(map.get(group) || []), item]); });
    return [...map.entries()];
  }, [navigation]);
  const initials = useMemo(() => { const parts = (userName || "User").trim().split(/\s+/); return `${parts[0]?.[0] || "U"}${parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""}`.toUpperCase(); }, [userName]);
  useEffect(() => { setMobile(false); setMenu(false); }, [pathname]);

  useEffect(() => {
    if (!mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobile]);

  async function signOut() { await onSignOut?.(); router.replace("/login"); }
  const shellStyle = { "--sidebar-width": collapsed ? "var(--acadlyx-sidebar-width-collapsed)" : "var(--acadlyx-sidebar-width-expanded)" } as CSSProperties;

  return <div className="acadlyx-dashboard-root min-h-screen" data-sidebar-collapsed={collapsed} style={shellStyle}>
    <aside className="acadlyx-dashboard-sidebar fixed inset-y-0 left-0 hidden flex-col overflow-hidden border-r p-3 shadow-[4px_0_18px_rgba(15,23,42,0.12)] lg:flex">
      <div className="flex h-14 shrink-0 items-center justify-center"><Brand logoUrl={logoUrl} institutionLogoUrl={institutionLogoUrl} collapsed={collapsed} /></div>
      <nav aria-label="Workspace navigation" className="acadlyx-dashboard-navigation mt-5 min-h-0 flex-1 overflow-y-auto space-y-5 pb-3 pr-1">
        {groups.map(([group, items]) => <div key={group}>{!collapsed && <p className="acadlyx-sidebar-group-label mb-2 px-2 text-[9px] font-black uppercase tracking-[0.18em]">{group}</p>}<div className="space-y-1">{items.map((item) => <NavigationLink key={`${item.href}-${item.label}`} item={item} pathname={pathname} collapsed={collapsed} />)}</div></div>)}
      </nav>
      <div className="shrink-0 border-t border-slate-700/70 pt-3"><button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-600/70 bg-slate-800 px-3 text-xs font-black text-slate-100 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"><SvgIcon name="chevron" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />{!collapsed && "Collapse"}</button></div>
    </aside>

    {mobile && <div className="fixed inset-0 z-[500] bg-slate-950/60 lg:hidden" role="presentation" onClick={() => setMobile(false)}><aside role="dialog" aria-modal="true" aria-label="Mobile workspace navigation" className="flex h-[100dvh] w-[min(86vw,300px)] flex-col overflow-hidden border-r border-slate-700 bg-[var(--acadlyx-sidebar-bg)] p-4 text-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex h-14 shrink-0 items-center justify-between"><Brand logoUrl={logoUrl} institutionLogoUrl={institutionLogoUrl} collapsed={false}/><button type="button" onClick={() => setMobile(false)} aria-label="Close navigation" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20"><span className="text-xl leading-none">×</span></button></div><nav className="acadlyx-dashboard-navigation mt-6 min-h-0 flex-1 overflow-y-auto space-y-1 pr-1">{groups.flatMap(([, items]) => items).map((item) => <NavigationLink key={`${item.href}-${item.label}`} item={item} pathname={pathname} collapsed={false} onNavigate={() => setMobile(false)} />)}</nav></aside></div>}

    <div className="acadlyx-dashboard-main min-w-0 max-w-full overflow-x-clip transition-[margin] duration-200">
      <header className="acadlyx-dashboard-header sticky top-0 z-40 min-w-0 border-b shadow-[0_1px_12px_rgba(51,45,36,0.07)] backdrop-blur-xl"><div className="flex min-h-[72px] min-w-0 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setMobile(true)} aria-label="Open navigation" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d8d0c4] bg-[#f5efe4] text-slate-800 hover:bg-[#ebe4d8] lg:hidden"><SvgIcon name="menu" /></button><div className="hidden shrink-0 lg:block"><Brand logoUrl={logoUrl} institutionLogoUrl={institutionLogoUrl} collapsed={false} /></div><div className="min-w-0"><h1 className="acadlyx-shell-title truncate">{title || "ACADLYX"}</h1>{(subtitle || institutionName) && <p className="hidden truncate text-[11px] font-semibold text-slate-600 sm:block">{subtitle || institutionName}</p>}</div></div>
        <div className="relative shrink-0"><button type="button" onClick={() => setMenu((value) => !value)} aria-expanded={menu} aria-haspopup="menu" aria-label="Open profile menu" data-open={menu} className="acadlyx-profile-button flex max-w-[calc(100vw-4.5rem)] items-center gap-2 rounded-xl border border-transparent px-2 py-1.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-black text-white ring-2 ring-blue-100">{initials}</span><span className="hidden min-w-0 text-left sm:block"><b className="block max-w-40 truncate text-xs">{userName || "User"}</b><span className="block max-w-40 truncate text-[10px] font-semibold text-slate-600">{userRole || "Account"}</span></span></button>{menu && <div role="menu" className="absolute right-2 top-12 z-[1000] w-[min(15rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"><Link role="menuitem" href="/profile" onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700"><SvgIcon name="profile" /></span><span><span className="block">My Profile</span><span className="block text-[10px] font-medium text-slate-500">View your complete profile</span></span></Link><div className="my-1 border-t border-slate-100"/><button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50"><SvgIcon name="logout" />Logout</button></div>}</div>
      </div></header>
      <main className="min-h-[calc(100vh-72px)] min-w-0 max-w-full overflow-x-clip p-3 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
