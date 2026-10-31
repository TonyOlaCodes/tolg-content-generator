import { NextResponse } from "next/server";
import { fetchForecast } from "@/weather/api";
import { errorResponse } from "@/weather/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (
    params.get("lat") === null ||
    params.get("lon") === null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }
  try {
    const forecast = await fetchForecast(latitude, longitude);
    return NextResponse.json(forecast, {
      headers: { "cache-control": "public, max-age=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
