"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-red-600 dark:text-red-300">Dashboard error</p>
        <h1 className="mt-2 text-2xl font-semibold">Unable to load analytics</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {error.message || "Check your Vercel Postgres environment variables and run the database migration."}
        </p>
        <button
          onClick={reset}
          className="mt-5 h-10 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-950"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
