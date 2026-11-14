/**
 * Prepares the database before each Vercel build (`npm run vercel-build`):
 * applies pending migrations, loads the sample catalogue into an empty database,
 * and keeps the admin account in sync with ADMIN_EMAIL / ADMIN_PASSWORD.
 * Safe to run any number of times; it never wipes existing products or orders.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { migrate } from "drizzle-orm/libsql/migrator";
import { ensureAdmin, isCatalogEmpty, seedCatalog } from "./catalog";

async function main() {
  // Imported after dotenv so the client sees DATABASE_URL.
  const { db } = await import("./index");

  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("db:setup — migrations applied");

  if (await isCatalogEmpty(db)) {
    const n = await seedCatalog(db);
    console.log(`db:setup — empty database, loaded sample catalogue (${n.products} products)`);
  }
  // A database that already has a catalogue is left exactly as the admin made it: nothing deleted in the
  // admin panel is ever created again by a deploy.

  console.log(
    (await ensureAdmin(db))
      ? "db:setup — admin account ready"
      : "db:setup — ADMIN_EMAIL / ADMIN_PASSWORD not set, no admin account created",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("db:setup failed:", e);
  process.exit(1);
});
