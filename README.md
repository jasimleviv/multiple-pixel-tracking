# PixelTrack

A modern Next.js App Router email tracking app. It creates campaign-specific 1x1 transparent GIF pixels and tracked click URLs, records every event in Postgres, and separates unique activity from duplicate activity by `(tracking_id, ip_address)`.

## Features

- `/api/open?id=TRACKING_ID` returns a real transparent GIF for email `<img>` tags.
- `/api/click?id=TRACKING_ID` records a click and redirects to the campaign destination URL.
- Vercel Postgres with Drizzle ORM and SQL migrations.
- Campaign creation with one or many generated recipient pixels.
- Total, unique, duplicate, open-rate, click-rate, latest-open, latest-click, user-agent, chart, search, pagination, date filter, CSV export, and copy-to-clipboard UI.
- Simple password authentication for the dashboard.
- Dark mode through system preference.

## Environment

Copy `.env.example` to `.env.local` for local development or configure the same variables in Vercel:

```bash
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
DATABASE_URL="postgres://..."
POSTGRES_USER="default"
POSTGRES_HOST="..."
POSTGRES_PASSWORD="..."
POSTGRES_DATABASE="verceldb"
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"
# Leave empty to disable dashboard authentication.
DASHBOARD_PASSWORD=
AUTH_SECRET="personal-project-no-auth-needed"
```

`NEXT_PUBLIC_APP_URL` is used to generate email-safe pixel URLs such as:

```html
<img src="https://your-domain.vercel.app/api/open?id=abc123" width="1" height="1" alt="" style="display:block;border:0;outline:0;" />
```

## Database

Run migrations after connecting Vercel Postgres:

```bash
npm run db:migrate
```

The app accepts Supabase or Vercel Marketplace Postgres connection strings through `POSTGRES_URL` or `DATABASE_URL`. The schema lives in `lib/db/schema.ts`; the initial SQL migration is in `drizzle/0000_initial.sql`.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Without Postgres variables, the app uses local file storage at `.data/pixeltrack-local.json`, so you can create campaigns immediately. Dashboard authentication is disabled when `DASHBOARD_PASSWORD` is empty.

## Verification

```bash
npm run lint
npm run build
```

The pixel endpoint should respond with:

- `Content-Type: image/gif`
- `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`

New generated tracking IDs are short, usually 8 characters, for URLs like:

```txt
https://your-domain.com/api/open?id=aB3xYz91
https://your-domain.com/api/click?id=aB3xYz91
```
