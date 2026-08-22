import { NextRequest, NextResponse } from "next/server";
import { isISODate, todayISO } from "@/lib/dates";
import { loadState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? todayISO();
  if (!isISODate(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  const state = await loadState(date);
  return NextResponse.json(state);
}
