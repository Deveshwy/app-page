import { NextRequest, NextResponse } from "next/server";
import { isISODate } from "@/lib/dates";
import { addSet, removeSet } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    date?: string;
    exerciseId?: string;
    reps?: number;
    weight?: number | null;
  };

  if (!body.date || !isISODate(body.date) || !body.exerciseId) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const reps = Number(body.reps);
  if (!Number.isFinite(reps) || reps <= 0 || reps > 500) {
    return NextResponse.json({ error: "invalid reps" }, { status: 400 });
  }

  let weight: number | null = null;
  if (body.weight != null) {
    const parsed = Number(body.weight);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2000) {
      return NextResponse.json({ error: "invalid weight" }, { status: 400 });
    }
    weight = parsed;
  }

  const workout = await addSet(body.date, body.exerciseId, { reps, weight });
  return NextResponse.json(workout);
}

export async function DELETE(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  const exerciseId = request.nextUrl.searchParams.get("exerciseId");
  const index = Number(request.nextUrl.searchParams.get("index"));

  if (!date || !isISODate(date) || !exerciseId || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const workout = await removeSet(date, exerciseId, index);
  return NextResponse.json(workout);
}
