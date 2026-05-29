import { sql } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";
import * as schema from "./schema";

export const db = drizzle(sql, { schema });

export function isDatabaseConfigured() {
  return Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
}
