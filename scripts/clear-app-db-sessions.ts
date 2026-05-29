import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL || "", {
  max: 1,
  prepare: false,
});

async function main() {
  const rows = await sql.unsafe(`
    select pg_terminate_backend(pid) as terminated, pid, left(query, 120) as query
    from pg_stat_activity
    where datname = current_database()
      and pid <> pg_backend_pid()
      and (
        query ilike '%"campaigns"%'
        or query ilike '%"recipients"%'
        or query ilike '%"open_events"%'
        or query ilike '%ALTER TABLE "campaigns"%'
      )
  `);

  console.log(JSON.stringify(rows, null, 2));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
