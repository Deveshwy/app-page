import { NextRequest, NextResponse } from "next/server";
import { lunaCoach, rulesCoach } from "@/lib/coach";
import { isISODate, todayISO } from "@/lib/dates";
import { listExercises, readWorkout, recentWorkouts } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? todayISO();
  if (!isISODate(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }

  const catalog = await listExercises();
  const recent = await recentWorkouts(date, 10);
  const today = await readWorkout(date, catalog);
  const luna = await lunaCoach(date, catalog, recent, today);
  return NextResponse.json(luna ?? rulesCoach(date, catalog, recent, today));
}
