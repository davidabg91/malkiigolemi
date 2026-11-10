import type { NextRequest } from "next/server";
import { searchSuggestions } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return Response.json([]);
  return Response.json(await searchSuggestions(q.toLowerCase()));
}
