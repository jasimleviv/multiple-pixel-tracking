import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL || "", {
  max: 1,
  prepare: false,
});

async function main() {
  const rows = await sql.unsafe(`
    select
      pid,
      state,
      wait_event_type,
      wait_event,
      now() - query_start as age,
      left(query, 160) as query
    from pg_stat_activity
    where datname = current_database()
    order by query_start nulls last
  `);

  console.log(JSON.stringify(rows, null, 2));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
