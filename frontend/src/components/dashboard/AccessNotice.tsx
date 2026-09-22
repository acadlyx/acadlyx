"use client";

import Link from "next/link";

export function AccessNotice({
  title = "This area isn't part of your workspace",
  message = "You are signed in successfully, but this area is not assigned to your current responsibilities.",
  homeHref = "/",
  homeLabel = "Go to my dashboard",
}: {
  title?: string;
  message?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <div className="max-w-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-700">
          —
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          Workspace access
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
          {message}
        </p>
        <Link
          href={homeHref}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
