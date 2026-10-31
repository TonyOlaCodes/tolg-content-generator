import { NextResponse } from "next/server";
import { searchPlaces } from "@/weather/api";
import { errorResponse } from "@/weather/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.length > 100) {
    return NextResponse.json({ error: "Search is too long." }, { status: 400 });
  }
  try {
    const places = await searchPlaces(q);
    return NextResponse.json({ places }, { headers: { "cache-control": "public, max-age=300" } });
  } catch (error) {
    return errorResponse(error);
  }
}
