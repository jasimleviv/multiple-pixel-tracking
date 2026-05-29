import postgres from "postgres";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error("Missing database URL");
}

const sql = postgres(connectionString, { max: 1, prepare: false });

async function main() {
  const results = {
    clickEvents: await sql`delete from "click_events" where length("tracking_id") <> 8 returning "id"`,
    uniqueClicks: await sql`delete from "unique_clicks" where length("tracking_id") <> 8 returning "id"`,
    openEvents: await sql`delete from "open_events" where length("tracking_id") <> 8 returning "id"`,
    uniqueOpens: await sql`delete from "unique_opens" where length("tracking_id") <> 8 returning "id"`,
    recipients: await sql`delete from "recipients" where length("tracking_id") <> 8 returning "id"`,
  };

  console.log(
    JSON.stringify(
      Object.fromEntries(Object.entries(results).map(([key, rows]) => [key, rows.length])),
      null,
      2,
    ),
  );

  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
