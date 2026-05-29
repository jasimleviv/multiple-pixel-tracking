import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

const client = postgres(connectionString, {
  max: 5,
  prepare: false,
});

export const db = drizzle(client, { schema });

export function isDatabaseConfigured() {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL);
}
