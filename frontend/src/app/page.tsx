import Image from "next/image";
import Link from "next/link";

const liveCapabilities = [
  ["Attendance", "Faculty marking and student attendance views."],
  ["Academics & subjects", "Departments, programmes, semesters, sections, courses and offerings."],
  ["Exams & marks", "Internal marks entry and student mark visibility."],
  ["Assignments", "Faculty publishing, student submission and review flows."],
  ["Faculty workspace", "Course attendance, assignment review and marks workflows."],
  ["Intelligence", "Academic health, risk signals and role-scoped institutional insights."],
];

const foundationCapabilities = ["Student management", "Timetable", "Fees", "Notices & communication", "Reports & analytics"];

const roles = [
  ["Student", "Attendance, coursework, marks and academic health."],
  ["Faculty", "Teaching, attendance, assignments and marks."],
  ["Admin", "Institutional academic structure and operations."],
  ["Management", "Institutional Command Center and intelligence."],
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Image src="/branding/acadlyx-logo.png" alt="ACADLYX" width={38} height={38} className="rounded-lg" priority />
          <span className="text-lg font-semibold tracking-tight">ACADLYX</span>
        </div>
        <Link href="/login" className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium transition hover:border-slate-300 hover:bg-slate-800">Login to ERP</Link>
      </header>

      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">ERP + Analytics + Institutional Intelligence</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">A clearer operating system for modern institutions.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">ACADLYX brings the core academic workflows already in this MVP into one focused platform for students, faculty and institutional leaders.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/login" className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Login to ERP</Link><a href="#capabilities" className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold hover:bg-slate-800">Explore capabilities</a></div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/60"><div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8"><div className="flex items-center gap-4"><Image src="/branding/aimt-logo.png" alt="Accurate Institute of Management & Technology" width={52} height={52} className="rounded-lg bg-white p-1 object-contain"/><div><p className="font-semibold">AIMT collaboration</p><p className="text-sm text-slate-400">Built for the Accurate Institute of Management &amp; Technology pilot.</p></div></div><div className="sm:border-l sm:border-slate-700 sm:pl-6"><p className="font-semibold">ACADLYX by Ayzent Solutions</p><p className="mt-1 text-sm text-slate-400">A product-focused foundation for connected academic operations.</p></div></div></section>

      <section id="capabilities" className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Available in this MVP</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Purpose-built workflows, not a generic portal.</h2><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{liveCapabilities.map(([title, text]) => <article key={title} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></article>)}</div><div className="mt-8 rounded-xl border border-dashed border-slate-700 p-5"><p className="font-medium">ERP foundation</p><p className="mt-2 text-sm text-slate-400">The following are recognised ERP areas, but are not represented as live workflows in this MVP: {foundationCapabilities.join(", ")}.</p></div></section>

      <section className="bg-slate-900"><div className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">One secure sign-in</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Designed around existing roles.</h2><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{roles.map(([title, text]) => <Link href="/login" key={title} className="rounded-xl border border-slate-700 bg-slate-950 p-5 transition hover:border-cyan-400"><p className="font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p><p className="mt-4 text-sm font-medium text-cyan-300">Sign in →</p></Link>)}</div></div></section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8"><p>© ACADLYX · Education ERP &amp; Institutional Intelligence</p><div className="flex gap-4"><Link href="/login" className="hover:text-white">ERP Login</Link><span>AIMT collaboration</span><span>Ayzent Solutions</span></div></footer>
    </main>
  );
}
