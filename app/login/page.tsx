import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { isAuthenticated, isAuthConfigured } from "@/lib/auth";

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthenticated()) {
    redirect("/");
  }

  const searchParams = await props.searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#d8f3dc,transparent_32%),linear-gradient(135deg,#f8fafc,#ecfeff_45%,#fff7ed)] px-4 py-10 text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,#064e3b,transparent_32%),linear-gradient(135deg,#020617,#0f172a_45%,#1f2937)] dark:text-slate-50">
      <section className="w-full max-w-md rounded-2xl border border-white/70 bg-white/75 p-8 shadow-2xl shadow-slate-200/80 backdrop-blur dark:border-white/10 dark:bg-slate-950/70 dark:shadow-black/30">
        <div className="mb-8">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">PixelTrack</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard sign in</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Enter the password configured in <code>DASHBOARD_PASSWORD</code>.
          </p>
        </div>
        {!isAuthConfigured() ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            Dashboard auth is not configured. Set <code>DASHBOARD_PASSWORD</code> before deploying.
          </div>
        ) : null}
        {searchParams.error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
            Incorrect password.
          </div>
        ) : null}
        <form action={loginAction} className="space-y-4">
          <input
            name="password"
            type="password"
            required
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none ring-emerald-500/20 transition focus:border-emerald-500 focus:ring-4 dark:border-slate-800 dark:bg-slate-900"
            placeholder="Password"
          />
          <button className="h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
