import { NextResponse } from "next/server";
import { getAvailableCities, getOffices } from "@/lib/courier-offices";
import type { CourierId } from "@/lib/couriers";
import { getActiveCouriersConfig } from "@/lib/couriers-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "offices";
  const courier = (searchParams.get("courier") || undefined) as CourierId | undefined;
  const type = (searchParams.get("type") || undefined) as "office" | "box" | undefined;
  const city = searchParams.get("city") || undefined;
  const query = searchParams.get("q") || undefined;

  if (action === "config") {
    const config = await getActiveCouriersConfig();
    return NextResponse.json({ activeCouriers: config });
  }

  if (action === "cities") {
    const cities = getAvailableCities(courier, type);
    return NextResponse.json({ cities });
  }

  const activeConfig = await getActiveCouriersConfig();
  // Offices are always looked up for one settlement; without it the answer would be the whole 500 KB list.
  const offices = city ? getOffices({ city, courier, type, query }) : [];
  return NextResponse.json({ offices, activeCouriers: activeConfig });
}
