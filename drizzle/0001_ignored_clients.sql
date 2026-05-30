CREATE TABLE IF NOT EXISTS "ignored_clients" (
  "id" serial PRIMARY KEY NOT NULL,
  "ip_address" varchar(96) NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ignored_clients_ip_user_agent_idx" ON "ignored_clients" ("ip_address", "user_agent");
CREATE INDEX IF NOT EXISTS "ignored_clients_ip_address_idx" ON "ignored_clients" ("ip_address");
