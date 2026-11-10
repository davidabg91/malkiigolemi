import { NextResponse } from "next/server";
import {
  getAvailableCities,
  getOffices,
  type CourierId,
} from "@/lib/couriers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "offices";
  const courier = (searchParams.get("courier") || undefined) as CourierId | undefined;
  const type = (searchParams.get("type") || undefined) as "office" | "box" | undefined;
  const city = searchParams.get("city") || undefined;
  const query = searchParams.get("q") || undefined;

  if (action === "cities") {
    const cities = getAvailableCities(courier, type);
    return NextResponse.json({ cities });
  }

  const offices = getOffices({ city, courier, type, query });
  return NextResponse.json({ offices });
}
