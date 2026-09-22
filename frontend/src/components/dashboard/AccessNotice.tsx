"use client";

import Link from "next/link";

export function AccessNotice({
  title = "This area is not part of your workspace",
  message = "Your account is active, but this area is not assigned to your current responsibility.",
  href = "/",
  actionLabel = "Return to workspace",
}: {
  title?: string;
  message?: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-lg">i</div>
      <h2 className="mt-4 text-xl font-black text-slate-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{message}</p>
      <Link href={href} className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
        {actionLabel}
      </Link>
    </section>
  );
}
