import { NextResponse } from "next/server";
import { WeatherApiError } from "./api";

export function errorResponse(error: unknown) {
  if (error instanceof WeatherApiError) {
    return NextResponse.json({ error: error.message, kind: error.kind }, { status: error.status });
  }
  return NextResponse.json({ error: "Something went wrong.", kind: "upstream" }, { status: 500 });
}
