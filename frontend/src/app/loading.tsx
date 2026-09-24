export default function Loading() {
  return (
    <div className="min-h-screen bg-[#eef3f8] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-slate-200/90 bg-white">
        <div className="flex h-full items-center px-3 sm:px-5">
          <div className="mr-3 h-9 w-9 animate-pulse rounded-xl bg-slate-200 lg:hidden" />

          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />

            <div className="hidden space-y-1 sm:block">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-2 w-16 animate-pulse rounded bg-slate-100" />
            </div>
          </div>

          <div className="ml-5 hidden border-l border-slate-200 pl-5 md:block">
            <div className="h-3 w-36 animate-pulse rounded bg-slate-200" />
            <div className="mt-1.5 h-2 w-48 animate-pulse rounded bg-slate-100" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden space-y-1 sm:block">
              <div className="ml-auto h-2.5 w-20 animate-pulse rounded bg-slate-200" />
              <div className="ml-auto h-2 w-14 animate-pulse rounded bg-slate-100" />
            </div>

            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />

            <div className="hidden h-9 w-16 animate-pulse rounded-xl bg-slate-100 sm:block" />
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-[240px] border-r border-slate-200/90 bg-[#f8fafc] lg:block">
        <div className="h-full overflow-hidden px-3 py-4">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="h-2 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100" />
          </div>

          <div className="space-y-5">
            {[1, 2, 3, 4].map(
              (section) => (
                <div key={section}>
                  <div className="mx-3 h-2 w-16 animate-pulse rounded bg-slate-200" />

                  <div className="mt-3 space-y-1.5">
                    {[1, 2, 3].map(
                      (item) => (
                        <div
                          key={item}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                        >
                          <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-200" />

                          <div className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
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

      <main className="min-h-screen pt-16 lg:pl-[240px]">
        <div className="mx-auto min-h-[calc(100vh-64px)] max-w-[1680px] px-3 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200" />

              <div className="mt-4 h-8 w-64 animate-pulse rounded-lg bg-slate-200" />

              <div className="mt-3 h-3 w-full max-w-xl animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-2/3 max-w-lg animate-pulse rounded bg-slate-100" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
                  />
                ),
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2].map(
                (item) => (
                  <div
                    key={item}
                    className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white"
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
