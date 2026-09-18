import Image from "next/image";
import Link from "next/link";

const capabilities = [
  ["People", "Students, faculty and teams in one reliable system of record."],
  ["Presence", "Live attendance workflows with the context to act early."],
  ["Academics", "Programs, subjects, sections and assessments connected end to end."],
  ["Scores", "A clearer view of assessment progress and academic performance."],
  ["My Week", "A single timetable experience for students and teaching teams."],
  ["Insights", "Tenant-safe intelligence for institutional decisions, not dashboard noise."],
];

const roles = ["Student", "Faculty", "HOD", "Management", "Institution Admin", "Super Admin"];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07111f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="ACADLYX home">
            <Image src="/branding/acadlyx-logo.png" alt="ACADLYX" width={40} height={40} className="h-10 w-10 rounded-xl object-contain" priority />
            <span className="text-sm font-bold tracking-[0.16em]">ACADLYX</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#capabilities" className="hidden text-sm font-medium text-slate-300 transition hover:text-white sm:block">Capabilities</a>
            <Link href="/login" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300">Enter workspace</Link>
          </div>
        </div>
      </header>

      <section className="relative isolate mx-auto max-w-7xl px-5 pb-24 pt-20 sm:px-8 sm:pb-32 sm:pt-28">
        <div className="absolute -left-32 top-0 -z-10 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute right-0 top-20 -z-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <p className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-cyan-200">THE OPERATING SYSTEM FOR MODERN EDUCATION</p>
        <div className="mt-7 grid items-end gap-12 lg:grid-cols-[1.15fr_.85fr]">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-semibold leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl">Education operations, with a clearer pulse.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">ACADLYX brings academic operations, student experience and institutional intelligence into one multi-tenant platform built for colleges and universities.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100">Enter ACADLYX</Link>
              <a href="#capabilities" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5">Explore the product</a>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur-sm">
            <p className="text-xs font-semibold tracking-[0.16em] text-cyan-200">ONE CONNECTED EXPERIENCE</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[["Home", "Your day, in focus"], ["Pulse", "See what needs attention"], ["Buzz", "Stay in the loop"], ["Vault", "Keep records together"]].map(([name, detail]) => <div key={name} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"><p className="font-semibold text-white">{name}</p><p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-y border-white/10 bg-white/[0.035]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl"><p className="text-sm font-semibold text-cyan-200">BUILT FOR THE WHOLE CAMPUS</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Enterprise-grade underneath. Human on top.</h2><p className="mt-4 leading-7 text-slate-400">Every workspace is permission-aware, institution-scoped and designed around the next useful action.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{capabilities.map(([title, text]) => <article key={title} className="group rounded-2xl border border-white/10 bg-[#091829] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-[#0b1d30]"><p className="text-lg font-semibold text-white">{title}</p><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p><span className="mt-5 block text-xs font-semibold text-cyan-200 opacity-0 transition group-hover:opacity-100">Designed to connect →</span></article>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-semibold text-cyan-200">ROLE-AWARE BY DESIGN</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">A home for every kind of campus work.</h2><p className="mt-4 leading-7 text-slate-400">The same platform adapts to the responsibilities and permissions already assigned to each user.</p></div><div className="flex flex-wrap content-start gap-3">{roles.map((role) => <span key={role} className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200">{role}</span>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8"><div className="rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-cyan-300/15 to-indigo-400/10 px-6 py-10 sm:px-10"><p className="text-sm font-semibold text-cyan-100">READY WHEN YOUR CAMPUS IS</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white">Bring the work into focus.</h2><p className="mt-3 max-w-xl text-slate-300">Sign in to access your permitted ACADLYX workspace.</p><Link href="/login" className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-100">Login to ACADLYX</Link></div></section>

      <footer className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span className="font-semibold tracking-[0.12em] text-slate-300">ACADLYX</span><span>Education ERP & institutional intelligence.</span></div></footer>
    </main>
  );
}
