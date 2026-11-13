"use server";

import { type AdminAlerts, getAdminAlerts } from "@/lib/admin-alerts";
import { getSession } from "@/lib/auth";

/** Fresh counts for the header's admin badge; null for anyone who is not an admin. */
export async function adminAlertsAction(): Promise<AdminAlerts | null> {
  const session = await getSession();
  return session?.role === "admin" ? getAdminAlerts() : null;
}
