export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="h-32 animate-pulse rounded-2xl bg-white/80 shadow-sm dark:bg-slate-900" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl bg-white/80 shadow-sm dark:bg-slate-900" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-white/80 shadow-sm dark:bg-slate-900" />
      </div>
    </main>
  );
}
