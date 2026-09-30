export default function AdminLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1500px] space-y-5"
      aria-label="Loading admin workspace"
      aria-busy="true"
    >
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-28 rounded-full bg-slate-200" />
          <div className="h-8 w-72 max-w-full rounded-lg bg-slate-200" />
          <div className="h-4 w-[28rem] max-w-full rounded bg-slate-100" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-[26px] border border-slate-200 bg-white shadow-sm"
          />
        ))}
      </section>

      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-5">
          <div className="h-5 w-44 rounded bg-slate-200" />

          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-14 rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
