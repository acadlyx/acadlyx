export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] animate-pulse">
        <div className="mb-6 h-8 w-56 rounded-xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-32 rounded-2xl bg-white ring-1 ring-slate-200/70" />
          <div className="h-32 rounded-2xl bg-white ring-1 ring-slate-200/70" />
          <div className="h-32 rounded-2xl bg-white ring-1 ring-slate-200/70" />
          <div className="h-32 rounded-2xl bg-white ring-1 ring-slate-200/70" />
        </div>
        <div className="mt-4 h-72 rounded-2xl bg-white ring-1 ring-slate-200/70" />
      </div>
    </div>
  );
}
