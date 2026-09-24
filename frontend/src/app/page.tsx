import Image from "next/image";
import Link from "next/link";

const modules = [
  {
    title: "Academic Management",
    description:
      "Manage programs, departments, courses, semesters, sections, faculty assignments and academic structures from one system.",
  },
  {
    title: "Student Management",
    description:
      "Maintain student records, enrollment, academic information, documents, movement and institutional history.",
  },
  {
    title: "Attendance",
    description:
      "Record attendance, monitor trends, review history and keep attendance workflows controlled by role and institution.",
  },
  {
    title: "Examinations & Results",
    description:
      "Organize examinations, schedules, marks, results, revaluation workflows and academic records.",
  },
  {
    title: "Fees & Finance",
    description:
      "Manage fee structures, invoices, payments, receipts and financial records with institution-level controls.",
  },
  {
    title: "Communication",
    description:
      "Publish notices, deliver notifications and keep students, faculty, parents and administrators connected.",
  },
];

const roles = [
  "Super Admin",
  "Institution Admin",
  "Management",
  "HOD",
  "Faculty",
  "Student",
  "Parent",
];

const highlights = [
  {
    title: "Multi-tenant architecture",
    description:
      "Each institution operates within its own secure organizational boundary.",
  },
  {
    title: "Role-based access",
    description:
      "Users see and operate only within the permissions assigned to their role.",
  },
  {
    title: "Centralized operations",
    description:
      "Academic, student, examination, attendance, finance and administrative workflows work together.",
  },
  {
    title: "Institutional visibility",
    description:
      "Leadership gets a consistent view of operational information without compromising user-level access.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="ACADLYX home"
          >
            <Image
              src="/branding/acadlyx-logo.png"
              alt="ACADLYX"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
            />

            <div className="leading-none">
              <span className="block text-[15px] font-bold tracking-[0.12em] text-slate-950">
                ACADLYX
              </span>
              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Education ERP
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <a
              href="#modules"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Modules
            </a>

            <a
              href="#platform"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Platform
            </a>

            <a
              href="#access"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Access & Security
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Sign in
            </Link>

            <Link
              href="/login"
              className="hidden rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 sm:inline-flex"
            >
              Access ACADLYX
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.9fr] lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
              Education Management Platform
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-[3.5rem]">
              A complete ERP platform for modern educational institutions.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              ACADLYX connects academic administration, student management,
              attendance, examinations, finance, communication and institutional
              operations in one secure platform.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
              >
                Sign in to ACADLYX
              </Link>

              <a
                href="#modules"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Explore modules
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              <span>Multi-tenant</span>
              <span>Role-based access</span>
              <span>Institution-scoped</span>
              <span>Centralized ERP</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  ACADLYX
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Institution Overview
                </p>
              </div>

              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Active
              </span>
            </div>

            <div className="grid grid-cols-2 gap-px bg-slate-200">
              {[
                ["Students", "2,486"],
                ["Faculty", "184"],
                ["Programs", "32"],
                ["Departments", "14"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="bg-white px-5 py-5"
                >
                  <p className="text-xs font-medium text-slate-500">
                    {label}
                  </p>

                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 px-5 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Academic activity
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Current institutional operations
                  </p>
                </div>

                <span className="text-sm font-semibold text-blue-700">
                  View
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  ["Attendance", "92%"],
                  ["Active courses", "148"],
                  ["Pending requests", "17"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm text-slate-600">
                      {label}
                    </span>

                    <span className="text-sm font-semibold text-slate-900">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="modules"
        className="border-b border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              ERP Modules
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              One platform for the institution.
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-600">
              ACADLYX brings the core functions of an educational institution
              into a consistent operating environment.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module, index) => (
              <article
                key={module.title}
                className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <h3 className="mt-5 text-lg font-semibold text-slate-950">
                  {module.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {module.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="border-b border-slate-200 bg-slate-50"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                Platform
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Built around how institutions actually operate.
              </h2>

              <p className="mt-5 text-base leading-7 text-slate-600">
                Instead of maintaining separate systems for individual
                departments and workflows, ACADLYX provides one connected
                operational platform.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((highlight) => (
                <article
                  key={highlight.title}
                  className="rounded-xl border border-slate-200 bg-white p-6"
                >
                  <div className="h-2 w-8 rounded-full bg-blue-700" />

                  <h3 className="mt-5 text-base font-semibold text-slate-950">
                    {highlight.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {highlight.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="access"
        className="border-b border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                Access & Security
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                The right information for the right user.
              </h2>

              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                ACADLYX uses institution-scoped and role-aware access so that
                administrators, faculty, students, parents and leadership work
                within the responsibilities assigned to them.
              </p>
            </div>

            <div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Supported workspaces
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Tenant isolation
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Institution-aware data boundaries.
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      RBAC
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Permissions aligned to responsibilities.
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Auditability
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Operational actions can be tracked.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
                ACADLYX
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
                A single platform for institutional operations.
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Sign in to access your authorized ACADLYX workspace.
              </p>
            </div>

            <Link
              href="/login"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Sign in to ACADLYX
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/branding/acadlyx-logo.png"
              alt="ACADLYX"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />

            <span className="text-sm font-bold tracking-[0.12em] text-slate-900">
              ACADLYX
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Education ERP & institutional management platform.
          </p>

          <Link
            href="/login"
            className="text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            Sign in
          </Link>
        </div>
      </footer>
    </main>
  );
}
