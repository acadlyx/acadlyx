"use client";

import Link from "next/link";
import {
useCallback,
useEffect,
useMemo,
useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "./DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import {
AdminWorkspace,
getAdminWorkspace,
} from "@/lib/adminApi";

type ModuleDefinition = {
key: keyof AdminWorkspace["modules"];
label: string;
eyebrow: string;
description: string;
icon: string;
href?: string;
tone: "primary" | "neutral" | "oversight";
};

const MODULES: ModuleDefinition[] = [
{
key: "users",
label: "People",
eyebrow: "Core administration",
description:
"Manage institution users, access status and profile pictures within your institution.",
icon: "♙",
href: "/user-management",
tone: "primary",
},
{
key: "students",
label: "Students",
eyebrow: "People",
description:
"Maintain student administration through the institution's authorized student workflows.",
icon: "◎",
href: "/students",
tone: "primary",
},
{
key: "academicStructure",
label: "Academic structure",
eyebrow: "Institution setup",
description:
"Manage departments, programs, academic years, semesters, sections, courses and offerings.",
icon: "▦",
href: "/enrollment",
tone: "primary",
},
{
key: "campuses",
label: "Campuses",
eyebrow: "Institution setup",
description:
"Maintain institution campuses and their administrative configuration.",
icon: "⌂",
href: "/institution-settings",
tone: "primary",
},
{
key: "timetable",
label: "Timetable",
eyebrow: "Institution operations",
description:
"Manage timetable information within the permissions granted to Institution Admin.",
icon: "◷",
href: "/timetable",
tone: "neutral",
},
{
key: "notices",
label: "Notices",
eyebrow: "Communication",
description:
"Publish and maintain institution-wide notices.",
icon: "◌",
href: "/notices",
tone: "neutral",
},
{
key: "calendar",
label: "Calendar",
eyebrow: "Communication",
description:
"Manage the institutional calendar within the configured scope.",
icon: "◫",
href: "/calendar",
tone: "neutral",
},
{
key: "notifications",
label: "Notifications",
eyebrow: "Communication",
description:
"Manage institution notifications and permitted notification delivery.",
icon: "◉",
href: "/notifications",
tone: "neutral",
},
{
key: "documents",
label: "Documents",
eyebrow: "Administration",
description:
"Manage institution-scoped documents available to the administrative role.",
icon: "▱",
href: "/forms",
tone: "neutral",
},
{
key: "operations",
label: "Operations",
eyebrow: "Administration",
description:
"Use operational controls explicitly granted to Institution Admin.",
icon: "⚙",
href: "/operations",
tone: "neutral",
},
{
key: "admissions",
label: "Admissions overview",
eyebrow: "View only",
description:
"View admission information. Admission processing authority belongs to Admissions.",
icon: "↗",
href: "/admissions",
tone: "oversight",
},
{
key: "registration",
label: "Course registration",
eyebrow: "View only",
description:
"View registration information without receiving registration approval authority.",
icon: "✓",
href: "/course-registration",
tone: "oversight",
},
{
key: "promotions",
label: "Student movement",
eyebrow: "View only",
description:
"View student movement information without assuming approval authority.",
icon: "↑",
href: "/student-promotion",
tone: "oversight",
},
{
key: "certificates",
label: "Certificates",
eyebrow: "View only",
description:
"View certificate information available to the institution administrator.",
icon: "▣",
href: "/certificates",
tone: "oversight",
},
{
key: "reports",
label: "Reports",
eyebrow: "Institution oversight",
description:
"View reports available within the Institution Admin permission scope.",
icon: "▤",
href: "/reports",
tone: "oversight",
},
{
key: "intelligence",
label: "Intelligence",
eyebrow: "Institution oversight",
description:
"Review institution-level intelligence without becoming an operational module owner.",
icon: "✦",
href: "/intelligence",
tone: "oversight",
},
{
key: "parentLinks",
label: "Parent links",
eyebrow: "People administration",
description:
"Manage parent-student relationships within the institution.",
icon: "♧",
tone: "primary",
},
{
key: "audit",
label: "Audit",
eyebrow: "Governance",
description:
"Review institution audit information for administrative accountability.",
icon: "⌁",
href: "/reports",
tone: "oversight",
},
{
key: "maintenance",
label: "Maintenance requests",
eyebrow: "Operations",
description:
"Raise maintenance requests without receiving unrelated technical authority.",
icon: "⌘",
href: "/operations",
tone: "neutral",
},
];

const METRICS: Array<{
key: keyof AdminWorkspace["stats"];
label: string;
caption: string;
emphasis?: boolean;
}> = [
{
key: "users",
label: "People",
caption: "Institution accounts",
emphasis: true,
},
{
key: "students",
label: "Students",
caption: "Active student accounts",
},
{
key: "faculty",
label: "Faculty",
caption: "Active faculty accounts",
},
{
key: "departments",
label: "Departments",
caption: "Active departments",
},
{
key: "programs",
label: "Programs",
caption: "Active programs",
},
{
key: "sections",
label: "Sections",
caption: "Active sections",
},
{
key: "courses",
label: "Courses",
caption: "Active courses",
},
{
key: "offerings",
label: "Offerings",
caption: "Active course offerings",
},
{
key: "campuses",
label: "Campuses",
caption: "Active campuses",
},
{
key: "usersMissingProfilePhoto",
label: "Profiles to complete",
caption: "People without a profile photo",
},
];

const EXCLUDED_OPERATIONAL_AREAS = [
"Fees & payments",
"Assignments",
"Marks",
"Examination operations",
"Result processing",
"Attendance operations",
"HR operations",
"Library operations",
"Placement operations",
"Payroll",
];

function formatNumber(value: number) {
return new Intl.NumberFormat("en-IN").format(
value || 0,
);
}

export function AdminPortal() {
const router = useRouter();

const [workspace, setWorkspace] =
useState<AdminWorkspace | null>(null);

const [loading, setLoading] =
useState(true);

const [error, setError] =
useState("");

const load = useCallback(async () => {
setLoading(true);
setError("");

```
try {
  const data =
    await getAdminWorkspace();

  setWorkspace(data);
} catch (reason) {
  if (
    reason instanceof AuthRequiredError
  ) {
    router.replace("/login");
    return;
  }

  setError(
    reason instanceof Error
      ? reason.message
      : "Unable to load the administration workspace.",
  );
} finally {
  setLoading(false);
}
```

}, [router]);

useEffect(() => {
void load();
}, [load]);

const visibleModules = useMemo(() => {
if (!workspace) {
return [];
}

```
return MODULES.filter(
  (module) =>
    workspace.modules[module.key] === true,
);
```

}, [workspace]);

const primaryModules =
visibleModules.filter(
(module) =>
module.tone === "primary",
);

const operationalModules =
visibleModules.filter(
(module) =>
module.tone === "neutral",
);

const oversightModules =
visibleModules.filter(
(module) =>
module.tone === "oversight",
);

return (
<DashboardShell
title="Institution Admin"
subtitle="People, structure and institutional administration"
allowedRoles={[
"INSTITUTION_ADMIN",
]}
> <main className="mx-auto max-w-7xl space-y-7 pb-10"> <section className="overflow-hidden rounded-[28px] bg-slate-950 p-7 text-white shadow-xl shadow-slate-200/40 sm:p-9"> <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"> <div className="max-w-3xl"> <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200"> <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
Institution workspace </div>

```
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Run the institution.
            <br />
            Not every department.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            This workspace is limited to the responsibilities
            assigned to Institution Admin. Operational ownership
            stays with the specialist teams responsible for it.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {workspace?.modules.users ? (
              <Link
                href="/user-management"
                className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
              >
                + Add people
              </Link>
            ) : null}

            {workspace?.modules.academicStructure ? (
              <Link
                href="/enrollment"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Academic structure
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <HeroStat
            label="People"
            value={
              workspace?.stats.users
            }
            loading={loading}
          />

          <HeroStat
            label="Students"
            value={
              workspace?.stats.students
            }
            loading={loading}
          />

          <HeroStat
            label="Faculty"
            value={
              workspace?.stats.faculty
            }
            loading={loading}
          />
        </div>
      </div>
    </section>

    {error ? (
      <section
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white"
          >
            Retry
          </button>
        </div>
      </section>
    ) : null}

    <section>
      <SectionHeading
        eyebrow="Institution snapshot"
        title="Know what is happening at a glance"
        description="Only institution-scoped administrative metrics are loaded into this workspace."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {METRICS.map((metric) => (
          <article
            key={metric.key}
            className={[
              "rounded-2xl border p-5 transition",
              metric.emphasis
                ? "border-indigo-200 bg-indigo-50/60"
                : "border-slate-200 bg-white",
            ].join(" ")}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              {metric.label}
            </p>

            <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {loading
                ? "…"
                : formatNumber(
                    Number(
                      workspace?.stats[
                        metric.key
                      ] ?? 0,
                    ),
                  )}
            </p>

            <p className="mt-1 text-xs font-medium text-slate-500">
              {metric.caption}
            </p>
          </article>
        ))}
      </div>
    </section>

    {primaryModules.length > 0 ? (
      <ModuleSection
        eyebrow="Core administration"
        title="People & institution"
        description="The areas where Institution Admin has direct administrative responsibility."
        modules={primaryModules}
      />
    ) : null}

    {operationalModules.length > 0 ? (
      <ModuleSection
        eyebrow="Institution operations"
        title="Keep the institution moving"
        description="Operational capabilities explicitly granted to this workspace."
        modules={operationalModules}
      />
    ) : null}

    {oversightModules.length > 0 ? (
      <ModuleSection
        eyebrow="Oversight"
        title="See without taking ownership"
        description="These areas are visible because the role has explicit read or oversight permission. Visibility does not transfer operational authority."
        modules={oversightModules}
      />
    ) : null}

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeading
        eyebrow="Responsibility boundary"
        title="Operational ownership stays with the right team"
        description="These areas are deliberately not part of the Institution Admin workspace."
      />

      <div className="mt-5 flex flex-wrap gap-2">
        {EXCLUDED_OPERATIONAL_AREAS.map(
          (item) => (
            <span
              key={item}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500"
            >
              {item}
            </span>
          ),
        )}
      </div>
    </section>
  </main>
</DashboardShell>
```

);
}

function HeroStat({
label,
value,
loading,
}: {
label: string;
value: number | undefined;
loading: boolean;
}) {
return ( <div className="min-w-[105px] rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"> <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
{label} </p>

```
  <p className="mt-2 text-2xl font-black">
    {loading
      ? "…"
      : formatNumber(value || 0)}
  </p>
</div>
```

);
}

function SectionHeading({
eyebrow,
title,
description,
}: {
eyebrow: string;
title: string;
description: string;
}) {
return ( <div className="mb-4"> <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
{eyebrow} </p>

```
  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
    {title}
  </h2>

  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
    {description}
  </p>
</div>
```

);
}

function ModuleSection({
eyebrow,
title,
description,
modules,
}: {
eyebrow: string;
title: string;
description: string;
modules: ModuleDefinition[];
}) {
return ( <section> <SectionHeading
     eyebrow={eyebrow}
     title={title}
     description={description}
   />

```
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {modules.map((module) => {
      const content = (
        <article className="group h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-200/50">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-lg text-white transition group-hover:bg-indigo-600">
              {module.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {module.eyebrow}
                  </p>

                  <h3 className="mt-1 font-black text-slate-950">
                    {module.label}
                  </h3>
                </div>

                {module.href ? (
                  <span className="text-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600">
                    →
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                {module.description}
              </p>
            </div>
          </div>
        </article>
      );

      return module.href ? (
        <Link
          key={module.key}
          href={module.href}
        >
          {content}
        </Link>
      ) : (
        <div key={module.key}>
          {content}
        </div>
      );
    })}
  </div>
</section>
```

);
}
