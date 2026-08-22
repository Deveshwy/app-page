import { NextRequest, NextResponse } from "next/server";
import { addExercise, listExercises } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listExercises());
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
    group?: string;
    cue?: string;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  try {
    const exercise = await addExercise({
      name: body.name,
      group: body.group,
      cue: body.cue,
    });
    return NextResponse.json(exercise);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed" },
      { status: 400 },
    );
  }
}
