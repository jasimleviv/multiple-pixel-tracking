import postgres from "postgres";

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error("Missing POSTGRES_URL_NON_POOLING, POSTGRES_URL, or DATABASE_URL");
}

const sql = postgres(connectionString, { max: 1, prepare: false });

async function main() {
  await sql`ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "click_url" text`;

  await sql`
    CREATE TABLE IF NOT EXISTS "click_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "tracking_id" varchar(96) NOT NULL,
      "recipient_id" integer REFERENCES "recipients"("id") ON DELETE set null,
      "campaign_id" integer REFERENCES "campaigns"("id") ON DELETE set null,
      "ip_address" varchar(96) NOT NULL,
      "user_agent" text,
      "country" varchar(80),
      "destination_url" text,
      "is_unique" boolean DEFAULT false NOT NULL,
      "clicked_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "unique_clicks" (
      "id" serial PRIMARY KEY NOT NULL,
      "tracking_id" varchar(96) NOT NULL,
      "recipient_id" integer REFERENCES "recipients"("id") ON DELETE cascade,
      "campaign_id" integer REFERENCES "campaigns"("id") ON DELETE cascade,
      "ip_address" varchar(96) NOT NULL,
      "user_agent" text,
      "first_clicked_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "click_events_tracking_id_idx" ON "click_events" ("tracking_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "click_events_recipient_id_idx" ON "click_events" ("recipient_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "click_events_campaign_id_idx" ON "click_events" ("campaign_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "click_events_clicked_at_idx" ON "click_events" ("clicked_at")`;
  await sql`CREATE INDEX IF NOT EXISTS "click_events_unique_idx" ON "click_events" ("is_unique")`;
  await sql`CREATE INDEX IF NOT EXISTS "click_events_ip_address_idx" ON "click_events" ("ip_address")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "unique_clicks_tracking_ip_idx" ON "unique_clicks" ("tracking_id", "ip_address")`;
  await sql`CREATE INDEX IF NOT EXISTS "unique_clicks_campaign_id_idx" ON "unique_clicks" ("campaign_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "unique_clicks_recipient_id_idx" ON "unique_clicks" ("recipient_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "unique_clicks_first_clicked_at_idx" ON "unique_clicks" ("first_clicked_at")`;

  await sql.end();
  console.log("Click tracking schema is ready.");
}

main().catch(async (error) => {
  await sql.end({ timeout: 5 }).catch(() => {});
  console.error(error);
  process.exit(1);
});
