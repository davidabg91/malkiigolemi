import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/limona.db";

const globalForDb = globalThis as unknown as { __libsql?: ReturnType<typeof createClient> };

// Reuse one connection across dev hot reloads.
const client =
  globalForDb.__libsql ?? createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
if (process.env.NODE_ENV !== "production") globalForDb.__libsql = client;

export const db = drizzle(client, { schema });
export { schema };
