export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="h-48 rounded-[30px] bg-white animate-pulse" />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 rounded-[26px] bg-white animate-pulse"
          />
        ))}
      </section>

      <section className="h-96 rounded-[30px] bg-white animate-pulse" />
    </div>
  );
}
