export default function Loading() {
  return (
    <div
      className="min-h-screen bg-[#07111f] text-slate-100"
      aria-busy="true"
      aria-label="Loading ACADLYX workspace"
    >
      <header className="fixed inset-x-0 top-0 z-50 h-[74px] border-b border-slate-700/80 bg-[#1d2939]/95">
        <div className="flex h-full items-center gap-3 px-3 sm:px-5 lg:px-7">
          <div className="h-10 w-10 animate-pulse rounded-[13px] bg-slate-700 lg:hidden" />

          <div className="h-10 w-10 animate-pulse rounded-[13px] bg-slate-800" />

          <div className="hidden space-y-1 sm:block">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-700" />
            <div className="h-2 w-16 animate-pulse rounded bg-slate-800" />
          </div>

          <div className="ml-5 hidden border-l border-slate-700 pl-5 md:block">
            <div className="h-3 w-36 animate-pulse rounded bg-slate-700" />
            <div className="mt-1.5 h-2 w-48 animate-pulse rounded bg-slate-800" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden space-y-1 xl:block">
              <div className="ml-auto h-2.5 w-20 animate-pulse rounded bg-slate-700" />
              <div className="ml-auto h-2 w-14 animate-pulse rounded bg-slate-800" />
            </div>

            <div className="h-10 w-10 animate-pulse rounded-[15px] bg-slate-800" />

            <div className="h-10 w-16 animate-pulse rounded-[15px] bg-slate-800" />
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-[74px] z-40 hidden w-[282px] border-r border-slate-800 bg-[#071525] lg:block">
        <div className="h-full overflow-hidden px-3 py-4">
          <div className="mb-4 rounded-[20px] border border-slate-700 bg-[#102137] px-4 py-4">
            <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-700" />
            <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-800" />
          </div>

          <div className="space-y-5">
            {[1, 2, 3, 4].map(
              (section) => (
                <div key={section}>
                  <div className="mx-3 h-2.5 w-16 animate-pulse rounded-full bg-slate-800" />

                  <div className="mt-3 space-y-1.5">
                    {[1, 2, 3].map(
                      (item) => (
                        <div
                          key={item}
                          className="flex h-[54px] items-center gap-3 rounded-[17px] px-3"
                        >
                          <div className="h-10 w-10 animate-pulse rounded-[14px] bg-slate-800" />

                          <div className="h-3 flex-1 animate-pulse rounded-full bg-slate-800" />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </aside>

      <main className="min-h-screen bg-[radial-gradient(circle_at_70%_0%,rgba(37,99,235,.08),transparent_30rem),linear-gradient(135deg,#f7faff,#eef4fa,#f8fbff)] pt-[74px] lg:pl-[282px]">
        <div className="mx-auto min-h-[calc(100vh-74px)] max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-2.5 w-24 animate-pulse rounded-full bg-slate-200" />

              <div className="mt-4 h-8 w-64 animate-pulse rounded-lg bg-slate-200" />

              <div className="mt-3 h-3 w-full max-w-xl animate-pulse rounded-full bg-slate-100" />

              <div className="mt-2 h-3 w-2/3 max-w-lg animate-pulse rounded-full bg-slate-100" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="h-28 animate-pulse rounded-[22px] border border-slate-200 bg-white"
                  />
                ),
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2].map(
                (item) => (
                  <div
                    key={item}
                    className="h-72 animate-pulse rounded-[24px] border border-slate-200 bg-white"
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
