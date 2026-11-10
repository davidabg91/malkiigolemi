import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * DATABASE_URL / DATABASE_AUTH_TOKEN are our own names; TURSO_* are what the Turso
 * integration on the Vercel Marketplace sets, so either works without renaming.
 */
export function databaseConfig() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (!url && process.env.VERCEL) {
    throw new Error("No database configured. Connect Turso in Vercel or set DATABASE_URL (see DEPLOY.md).");
  }
  return {
    url: url || "file:./data/limona.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
  };
}

const globalForDb = globalThis as unknown as { __libsql?: ReturnType<typeof createClient> };

// Reuse one connection across dev hot reloads.
const client = globalForDb.__libsql ?? createClient(databaseConfig());
if (process.env.NODE_ENV !== "production") globalForDb.__libsql = client;

export const db = drizzle(client, { schema });
export { schema };
