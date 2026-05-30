import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownToLine,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createCampaignAction, excludeTrackingClientAction, reincludeTrackingClientAction } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { isAuthenticated, isAuthConfigured } from "@/lib/auth";
import { getDashboardData, getRecipients } from "@/lib/tracking";
import { isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

type HomeSearchParams = {
  from?: string;
  to?: string;
  q?: string;
  page?: string;
  created?: string;
  error?: string;
};

function cardClass() {
  return "rounded-2xl border border-white/70 bg-white/75 shadow-xl shadow-slate-200/60 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-slate-950/65 dark:shadow-black/20";
}

function dateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function Home(props: { searchParams: Promise<HomeSearchParams> }) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const range = {
    from: searchParams.from,
    to: searchParams.to,
    q: searchParams.q,
    page: Number(searchParams.page ?? 1),
  };

  const [dashboard, recipientPage] = await Promise.all([
    getDashboardData(range),
    getRecipients(range),
  ]);

  const exportHref = `/api/export?${new URLSearchParams({
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
  }).toString()}`;
  const databaseConfigured = isDatabaseConfigured();
  const authConfigured = isAuthConfigured();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d8f3dc,transparent_30%),radial-gradient(circle_at_80%_20%,#dbeafe,transparent_28%),linear-gradient(135deg,#f8fafc,#ffffff_48%,#fff7ed)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,#064e3b,transparent_30%),radial-gradient(circle_at_80%_20%,#1e3a8a,transparent_28%),linear-gradient(135deg,#020617,#0f172a_48%,#111827)] dark:text-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-lg shadow-slate-200/50 backdrop-blur dark:border-white/10 dark:bg-slate-950/50 dark:shadow-black/20 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                <Sparkles className="h-4 w-4" />
              </span>
              PixelTrack
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Email open analytics</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Create short campaign pixels and tracked links, then measure unique opens and clicks without counting repeated IPs twice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={exportHref}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Export CSV
            </a>
            {authConfigured ? (
              <form action="/api/logout" method="post">
                <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                  <ShieldCheck className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            ) : (
              <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/25">
                <ShieldCheck className="h-4 w-4" />
                Auth off
              </span>
            )}
          </div>
        </header>

        {!authConfigured ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            Dashboard authentication is disabled because <code>DASHBOARD_PASSWORD</code> is empty. This matches the current personal-project setup.
          </section>
        ) : null}

        {!databaseConfigured ? (
          <section className="rounded-2xl border border-sky-200 bg-sky-50/90 p-4 text-sm leading-6 text-sky-900 shadow-sm dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-100">
            Vercel Postgres is not configured, so this machine is using local file storage at <code>.data/pixeltrack-local.json</code>. Connect Vercel Postgres and run <code>npm run db:migrate</code> when you want hosted persistence.
          </section>
        ) : null}

        {searchParams.created ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-900 shadow-sm dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
            Campaign created. The recipient table below contains the pixel URL and HTML for each email or campaign segment.
          </section>
        ) : null}
        {searchParams.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800 shadow-sm dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100">
            {searchParams.error}
          </section>
        ) : null}

        <section className={`${cardClass()} p-5`}>
          <div className="mb-5 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Create campaign tracking</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Generate short pixel IDs and click-through URLs for one or many recipients.</p>
            </div>
          </div>
          <form action={createCampaignAction} className="grid gap-4 lg:grid-cols-2">
            <input name="name" required maxLength={160} placeholder="Campaign name" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900" />
            <input name="clickUrl" type="url" placeholder="Click destination URL, e.g. https://example.com/offer" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900" />
            <textarea name="description" rows={4} placeholder="Description" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900" />
            <textarea
              name="recipients"
              rows={4}
              placeholder={"Optional: one email or label per line\nalice@example.com\nVIP segment\nnewsletter-batch-02"}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900"
            />
            <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-700 lg:col-span-2">
              <Mail className="h-4 w-4" />
              Generate tracking links
            </button>
          </form>
        </section>

        <section className={`${cardClass()} p-5`}>
            <h2 className="text-lg font-semibold">Latest opens</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
              {dashboard.latestOpens.length ? (
                dashboard.latestOpens.map((event) => (
                  <div key={event.id} className="grid gap-2 border-b border-slate-100 bg-white/60 p-4 last:border-0 dark:border-slate-800 dark:bg-slate-900/55 sm:grid-cols-[1fr_auto]">
                    <div>
                      <p className="font-medium">{event.email || event.label || event.campaignName || event.ipAddress}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{event.userAgent || "Unknown user agent"}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">IP {event.ipAddress} · Opened {dateTime(event.openedAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400 sm:justify-end">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${event.isUnique ? "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                        {event.isUnique ? "Unique" : "Duplicate"}
                      </span>
                      <form action={excludeTrackingClientAction}>
                        <input type="hidden" name="ipAddress" value={event.ipAddress} />
                        <input type="hidden" name="userAgent" value={event.userAgent || ""} />
                        <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-400/30 dark:text-red-200 dark:hover:bg-red-400/10">
                          Exclude
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <p className="bg-white/50 p-6 text-sm text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">No opens recorded yet.</p>
              )}
            </div>
            {dashboard.ignoredClients.length ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold">Excluded clients</h3>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                  {dashboard.ignoredClients.map((client) => (
                    <div key={client.id} className="grid gap-2 border-b border-slate-100 bg-white/60 p-3 last:border-0 dark:border-slate-800 dark:bg-slate-900/55 sm:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-slate-600 dark:text-slate-300">IP {client.ipAddress}</p>
                        <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{client.userAgent || "Unknown user agent"}</p>
                      </div>
                      <form action={reincludeTrackingClientAction} className="self-center sm:justify-self-end">
                        <input type="hidden" name="id" value={client.id} />
                        <button className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-400/10">
                          Re-include
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
        </section>

        <section className={`${cardClass()} p-5`}>
          <h2 className="text-lg font-semibold">Latest clicks</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
            {dashboard.latestClicks.length ? (
              dashboard.latestClicks.map((event) => (
                <div key={event.id} className="grid gap-2 border-b border-slate-100 bg-white/60 p-4 last:border-0 dark:border-slate-800 dark:bg-slate-900/55 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium">{event.email || event.label || event.campaignName || event.ipAddress}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{event.destinationUrl || "No click destination"}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">IP {event.ipAddress} · Clicked {dateTime(event.clickedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${event.isUnique ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                      {event.isUnique ? "Unique" : "Duplicate"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="bg-white/50 p-6 text-sm text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">No clicks recorded yet.</p>
            )}
          </div>
        </section>

        <section className={`${cardClass()} p-5`}>
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Recipients, pixels, and click links</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Use the image source in email HTML and the click URL as your email link href.</p>
            </div>
            <form className="flex w-full gap-2 lg:w-auto">
              <div className="relative flex-1 lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input name="q" defaultValue={range.q} placeholder="Search recipients" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-800 dark:bg-slate-900" />
              </div>
              <button className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-950">Search</button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3">Campaign</th>
                  <th className="px-3 py-3">Recipient</th>
                  <th className="px-3 py-3">Opens</th>
                  <th className="px-3 py-3">Clicks</th>
                  <th className="px-3 py-3">Image source</th>
                  <th className="px-3 py-3">HTML</th>
                  <th className="px-3 py-3">Click URL</th>
                </tr>
              </thead>
              <tbody>
                {recipientPage.rows.map((recipient) => (
                  <tr key={recipient.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-4 text-slate-600 dark:text-slate-300">{recipient.campaignName}</td>
                    <td className="px-3 py-4">
                      <p className="font-medium">{recipient.email || recipient.label || "Untitled pixel"}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{recipient.trackingId}</p>
                    </td>
                    <td className="px-3 py-4">
                      <span className="font-semibold">{recipient.totalOpens}</span>
                      <span className="text-slate-500"> total</span>
                      <span className="ml-2 font-semibold text-sky-600 dark:text-sky-300">{recipient.uniqueOpens}</span>
                      <span className="text-slate-500"> unique</span>
                    </td>
                    <td className="px-3 py-4">
                      <span className="font-semibold">{recipient.totalClicks}</span>
                      <span className="text-slate-500"> total</span>
                      <span className="ml-2 font-semibold text-emerald-600 dark:text-emerald-300">{recipient.uniqueClicks}</span>
                      <span className="text-slate-500"> unique</span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex max-w-xs items-center gap-2">
                        <code className="truncate rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{recipient.pixelUrl}</code>
                        <CopyButton value={recipient.pixelUrl} label="Src" />
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <CopyButton value={recipient.pixelHtml} label="HTML" />
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex max-w-xs items-center gap-2">
                        <code className="truncate rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{recipient.clickUrl}</code>
                        <CopyButton value={recipient.clickUrl} label="Click" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recipientPage.rows.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No recipients yet. Create a campaign to generate your first tracking pixel.
              </div>
            ) : null}
          </div>
          <div className="mt-5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>
              Page {recipientPage.page} of {recipientPage.totalPages}
            </span>
            <div className="flex gap-2">
              <Link
                aria-disabled={recipientPage.page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-2 transition hover:bg-white aria-disabled:pointer-events-none aria-disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-900"
                href={`/?${new URLSearchParams({ ...(range.q ? { q: range.q } : {}), page: String(Math.max(1, recipientPage.page - 1)) })}`}
              >
                Previous
              </Link>
              <Link
                aria-disabled={recipientPage.page >= recipientPage.totalPages}
                className="rounded-lg border border-slate-200 px-3 py-2 transition hover:bg-white aria-disabled:pointer-events-none aria-disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-900"
                href={`/?${new URLSearchParams({ ...(range.q ? { q: range.q } : {}), page: String(Math.min(recipientPage.totalPages, recipientPage.page + 1)) })}`}
              >
                Next
              </Link>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
