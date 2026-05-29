CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(160) NOT NULL,
  "description" text,
  "click_url" text,
  "slug" varchar(64) NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recipients" (
  "id" serial PRIMARY KEY NOT NULL,
  "campaign_id" integer NOT NULL REFERENCES "campaigns"("id") ON DELETE cascade,
  "email" varchar(254),
  "label" varchar(180),
  "tracking_id" varchar(96) NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "open_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "tracking_id" varchar(96) NOT NULL,
  "recipient_id" integer REFERENCES "recipients"("id") ON DELETE set null,
  "campaign_id" integer REFERENCES "campaigns"("id") ON DELETE set null,
  "ip_address" varchar(96) NOT NULL,
  "user_agent" text,
  "country" varchar(80),
  "is_unique" boolean DEFAULT false NOT NULL,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "unique_opens" (
  "id" serial PRIMARY KEY NOT NULL,
  "tracking_id" varchar(96) NOT NULL,
  "recipient_id" integer REFERENCES "recipients"("id") ON DELETE cascade,
  "campaign_id" integer REFERENCES "campaigns"("id") ON DELETE cascade,
  "ip_address" varchar(96) NOT NULL,
  "user_agent" text,
  "first_opened_at" timestamp with time zone DEFAULT now() NOT NULL
);

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
);

CREATE TABLE IF NOT EXISTS "unique_clicks" (
  "id" serial PRIMARY KEY NOT NULL,
  "tracking_id" varchar(96) NOT NULL,
  "recipient_id" integer REFERENCES "recipients"("id") ON DELETE cascade,
  "campaign_id" integer REFERENCES "campaigns"("id") ON DELETE cascade,
  "ip_address" varchar(96) NOT NULL,
  "user_agent" text,
  "first_clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_slug_idx" ON "campaigns" ("slug");
CREATE INDEX IF NOT EXISTS "campaigns_created_at_idx" ON "campaigns" ("created_at");
CREATE INDEX IF NOT EXISTS "recipients_campaign_id_idx" ON "recipients" ("campaign_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recipients_tracking_id_idx" ON "recipients" ("tracking_id");
CREATE INDEX IF NOT EXISTS "recipients_email_idx" ON "recipients" ("email");
CREATE INDEX IF NOT EXISTS "open_events_tracking_id_idx" ON "open_events" ("tracking_id");
CREATE INDEX IF NOT EXISTS "open_events_recipient_id_idx" ON "open_events" ("recipient_id");
CREATE INDEX IF NOT EXISTS "open_events_campaign_id_idx" ON "open_events" ("campaign_id");
CREATE INDEX IF NOT EXISTS "open_events_opened_at_idx" ON "open_events" ("opened_at");
CREATE INDEX IF NOT EXISTS "open_events_unique_idx" ON "open_events" ("is_unique");
CREATE INDEX IF NOT EXISTS "open_events_ip_address_idx" ON "open_events" ("ip_address");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_opens_tracking_ip_idx" ON "unique_opens" ("tracking_id", "ip_address");
CREATE INDEX IF NOT EXISTS "unique_opens_campaign_id_idx" ON "unique_opens" ("campaign_id");
CREATE INDEX IF NOT EXISTS "unique_opens_recipient_id_idx" ON "unique_opens" ("recipient_id");
CREATE INDEX IF NOT EXISTS "unique_opens_first_opened_at_idx" ON "unique_opens" ("first_opened_at");
CREATE INDEX IF NOT EXISTS "click_events_tracking_id_idx" ON "click_events" ("tracking_id");
CREATE INDEX IF NOT EXISTS "click_events_recipient_id_idx" ON "click_events" ("recipient_id");
CREATE INDEX IF NOT EXISTS "click_events_campaign_id_idx" ON "click_events" ("campaign_id");
CREATE INDEX IF NOT EXISTS "click_events_clicked_at_idx" ON "click_events" ("clicked_at");
CREATE INDEX IF NOT EXISTS "click_events_unique_idx" ON "click_events" ("is_unique");
CREATE INDEX IF NOT EXISTS "click_events_ip_address_idx" ON "click_events" ("ip_address");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_clicks_tracking_ip_idx" ON "unique_clicks" ("tracking_id", "ip_address");
CREATE INDEX IF NOT EXISTS "unique_clicks_campaign_id_idx" ON "unique_clicks" ("campaign_id");
CREATE INDEX IF NOT EXISTS "unique_clicks_recipient_id_idx" ON "unique_clicks" ("recipient_id");
CREATE INDEX IF NOT EXISTS "unique_clicks_first_clicked_at_idx" ON "unique_clicks" ("first_clicked_at");
