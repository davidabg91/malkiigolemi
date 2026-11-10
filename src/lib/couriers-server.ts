import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  DEFAULT_ACTIVE_COURIERS,
  type CourierId,
} from "@/lib/couriers";

const SETTINGS_KEY = "active_couriers";

/** Get currently active couriers configuration from database */
export async function getActiveCouriersConfig(): Promise<Record<CourierId, boolean>> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, SETTINGS_KEY))
      .limit(1);

    if (!row || !row.value) {
      return { ...DEFAULT_ACTIVE_COURIERS };
    }

    const parsed = JSON.parse(row.value) as Partial<Record<CourierId, boolean>>;
    return {
      econt: parsed.econt !== false,
      speedy: parsed.speedy !== false,
      boxnow: parsed.boxnow !== false,
      penguin: parsed.penguin !== false,
    };
  } catch (err) {
    console.error("Failed to load active couriers config:", err);
    return { ...DEFAULT_ACTIVE_COURIERS };
  }
}

/** Update active couriers configuration in database */
export async function setActiveCouriersConfig(
  config: Record<CourierId, boolean>,
): Promise<void> {
  const value = JSON.stringify(config);
  await db
    .insert(settings)
    .values({
      key: SETTINGS_KEY,
      value,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value,
      },
    });
}
