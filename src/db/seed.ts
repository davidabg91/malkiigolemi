/**
 * Wipes and re-creates the sample catalogue (orders and customers are kept).
 * Run with: npm run db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { ensureAdmin, seedCatalog } from "./catalog";

async function main() {
  mkdirSync("data", { recursive: true });
  // Imported after dotenv so the client sees DATABASE_URL.
  const { db } = await import("./index");
  await migrate(db, { migrationsFolder: "./drizzle" });
  const n = await seedCatalog(db);
  await ensureAdmin(db);
  console.log(`Seeded ${n.categories} categories, ${n.brands} brands, ${n.products} products.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
