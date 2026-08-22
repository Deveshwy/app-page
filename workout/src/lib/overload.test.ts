import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPlan,
  cardFor,
  planLift,
  remainingWhy,
  snapReps,
} from "./overload";
import { parseExercises, parseWorkout } from "./parse";
import type { Exercise, ExerciseLog, Workout } from "./types";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function lift(id: string, name: string, reps: number[], weight: number | null): ExerciseLog {
  return {
    id,
    name,
    sets: reps.map((n) => ({ reps: n, weight })),
  };
}

function session(date: string, exercises: ExerciseLog[]): Workout {
  return { date, exercises };
}

const catalog: Exercise[] = parseExercises(
  readFileSync(path.join(root, "data/exercises.md"), "utf8"),
);

function seedWorkouts(): Workout[] {
  return ["2026-06-27", "2026-08-10", "2026-08-13"].map((date) => {
    const markdown = readFileSync(path.join(root, "data/workouts", `${date}.md`), "utf8");
    return parseWorkout(date, markdown);
  });
}

function goal(plan: ReturnType<typeof buildPlan>, id: string) {
  const found = plan.goals.find((item) => item.exerciseId === id);
  assert.ok(found, `missing goal ${id}`);
  return found;
}

{
  const plan = buildPlan(catalog, seedWorkouts(), "2026-08-22");
  const ids = plan.goals.map((item) => item.exerciseId);
  assert.deepEqual(ids.slice(0, 3), ["shoulder-press", "lateral-raise", "bicep-curl"]);
  assert.equal(ids[3], "goblet-squat");

  const press = goal(plan, "shoulder-press");
  assert.equal(press.sets, 3);
  assert.equal(press.reps, 10);
  assert.equal(press.weight, null);
  assert.equal(press.action, "deload");
  assert.equal(press.targetLabel, "3 × 10");
  assert.doesNotMatch(press.targetLabel, /lb/);

  const laterals = goal(plan, "lateral-raise");
  assert.equal(laterals.sets, 3);
  assert.equal(laterals.reps, 12);
  assert.equal(laterals.weight, null);
  assert.notEqual(laterals.reps, 13);

  const curls = goal(plan, "bicep-curl");
  assert.equal(curls.sets, 3);
  assert.equal(curls.reps, 12);
  assert.equal(curls.weight, null);

  const squat = goal(plan, "goblet-squat");
  assert.equal(squat.action, "optional");
  assert.equal(squat.sets, 3);
  assert.equal(squat.reps, 8);
  assert.equal(squat.weight, null);
}

{
  const press = catalog.find((item) => item.id === "shoulder-press")!;
  const fresh = cardFor(
    press,
    [session("2026-08-20", [lift("shoulder-press", "Shoulder Press", [12, 12, 12], 20)])],
    "2026-08-22",
  );
  const planned = planLift(fresh);
  assert.equal(planned.action, "add_weight");
  assert.equal(planned.sets, 3);
  assert.equal(planned.reps, 8);
  assert.equal(planned.weight, 22.5);
}

{
  const press = catalog.find((item) => item.id === "shoulder-press")!;
  const stale = cardFor(
    press,
    [session("2026-08-13", [lift("shoulder-press", "Shoulder Press", [12, 12, 12], 20)])],
    "2026-08-22",
  );
  const planned = planLift(stale);
  assert.equal(planned.action, "deload");
  assert.equal(planned.sets, 3);
  assert.equal(planned.reps, 10);
  assert.equal(planned.weight, 20);
}

{
  const raise = catalog.find((item) => item.id === "lateral-raise")!;
  const messy = cardFor(
    raise,
    [session("2026-08-20", [lift("lateral-raise", "Lateral Raise", [12, 8, 14, 13], null)])],
    "2026-08-22",
  );
  const planned = planLift(messy);
  assert.equal(planned.action, "even_up");
  assert.equal(planned.reps, 12);
  assert.equal(planned.weight, null);
}

{
  const press = catalog.find((item) => item.id === "shoulder-press")!;
  const drop = cardFor(
    press,
    [session("2026-08-20", [lift("shoulder-press", "Shoulder Press", [17, 10], null)])],
    "2026-08-22",
  );
  const planned = planLift(drop);
  assert.equal(planned.action, "even_up");
  assert.equal(planned.reps, 10);
  assert.notEqual(planned.reps, 14);
  assert.equal(planned.weight, null);
}

{
  const curl = catalog.find((item) => item.id === "bicep-curl")!;
  const even = cardFor(
    curl,
    [session("2026-08-20", [lift("bicep-curl", "Bicep Curl", [10, 10, 10], 25)])],
    "2026-08-22",
  );
  const planned = planLift(even);
  assert.equal(planned.action, "add_reps");
  assert.equal(planned.reps, 11);
  assert.equal(planned.weight, 25);
}

{
  const press = catalog.find((item) => item.id === "shoulder-press")!;
  const top = cardFor(
    press,
    [session("2026-08-20", [lift("shoulder-press", "Shoulder Press", [12, 12, 12], null)])],
    "2026-08-22",
  );
  const planned = planLift(top);
  assert.equal(planned.action, "hold");
  assert.equal(planned.reps, 12);
  assert.equal(planned.weight, null);
}

assert.equal(snapReps("isolation", 13), 12);
assert.equal(snapReps("compound", 11), 10);
assert.equal(remainingWhy("Even tens.", 1, 3), "2 left. Even tens.");
assert.equal(remainingWhy("Even tens.", 0, 3), "Even tens.");
assert.equal(remainingWhy("Even tens.", 3, 3), "Even tens.");

console.log("overload tests passed");
