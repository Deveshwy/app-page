import { promises as fs } from "fs";
import path from "path";
import { isISODate } from "./dates";
import { lastWeight, totalReps, volumeOf } from "./format";
import { kindOf } from "./overload";
import {
  attachCatalog,
  parseExercises,
  parseWorkout,
  stringifyNewExercise,
  stringifyWorkout,
} from "./parse";
import type {
  AppState,
  DayActivity,
  Exercise,
  ProgressPoint,
  SetEntry,
  Workout,
} from "./types";

const WORKOUTS_DIR = path.join(process.cwd(), "data/workouts");
const EXERCISES_FILE = path.join(process.cwd(), "data/exercises.md");

let queue: Promise<unknown> = Promise.resolve();

function lock<T>(fn: () => Promise<T>) {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureDirs() {
  await fs.mkdir(WORKOUTS_DIR, { recursive: true });
}

async function writeAtomic(file: string, contents: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, file);
}

export async function listExercises() {
  await ensureDirs();
  const markdown = await fs.readFile(EXERCISES_FILE, "utf8");
  return parseExercises(markdown);
}

async function workoutPath(date: string) {
  if (!isISODate(date)) throw new Error("invalid date");
  return path.join(WORKOUTS_DIR, `${date}.md`);
}

export async function readWorkout(date: string, catalog?: Exercise[]) {
  const exercises = catalog ?? (await listExercises());
  const file = await workoutPath(date);
  try {
    const markdown = await fs.readFile(file, "utf8");
    return attachCatalog(parseWorkout(date, markdown), exercises);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { date, exercises: [] } satisfies Workout;
    }
    throw error;
  }
}

export async function listWorkoutDates() {
  await ensureDirs();
  const files = await fs.readdir(WORKOUTS_DIR);
  return files
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""))
    .filter(isISODate)
    .sort();
}

async function writeWorkout(workout: Workout) {
  const file = await workoutPath(workout.date);
  if (!workout.exercises.length) {
    try {
      await fs.unlink(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return;
  }
  await writeAtomic(file, stringifyWorkout(workout));
}

export async function addSet(
  date: string,
  exerciseId: string,
  set: SetEntry,
) {
  return lock(async () => {
    const catalog = await listExercises();
    const exercise = catalog.find((item) => item.id === exerciseId);
    if (!exercise) throw new Error("unknown exercise");

    const workout = await readWorkout(date, catalog);
    const existing = workout.exercises.find((item) => item.id === exerciseId);
    if (existing) existing.sets.push(set);
    else {
      workout.exercises.push({
        id: exercise.id,
        name: exercise.name,
        sets: [set],
      });
    }
    await writeWorkout(workout);
    return workout;
  });
}

export async function removeSet(
  date: string,
  exerciseId: string,
  index: number,
) {
  return lock(async () => {
    const catalog = await listExercises();
    const workout = await readWorkout(date, catalog);
    const existing = workout.exercises.find((item) => item.id === exerciseId);
    if (!existing) return workout;
    existing.sets.splice(index, 1);
    workout.exercises = workout.exercises.filter((item) => item.sets.length);
    await writeWorkout(workout);
    return workout;
  });
}

export async function addExercise(input: {
  name: string;
  group?: string;
  cue?: string;
}) {
  return lock(async () => {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("name too short");
    const catalog = await listExercises();
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const exercise: Exercise = {
      id,
      name,
      group: (input.group ?? "other").trim() || "other",
      kind: kindOf({ id }),
      image: null,
      cue: input.cue?.trim() ?? "",
      aliases: [],
    };
    if (catalog.some((item) => item.id === exercise.id)) {
      throw new Error("exercise already exists");
    }
    await fs.appendFile(EXERCISES_FILE, stringifyNewExercise(exercise), "utf8");
    return exercise;
  });
}

function dayStats(workout: Workout): DayActivity {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  return {
    date: workout.date,
    reps: totalReps(sets),
    volume: volumeOf(sets),
  };
}

export async function loadState(date: string): Promise<AppState> {
  const catalog = await listExercises();
  const dates = await listWorkoutDates();
  const workouts = await Promise.all(
    dates.map((day) => readWorkout(day, catalog)),
  );

  const activity = workouts
    .map(dayStats)
    .filter((day) => day.reps > 0);

  const progress: Record<string, ProgressPoint[]> = {};
  const lastByExercise: AppState["lastByExercise"] = {};

  for (const workout of workouts) {
    for (const log of workout.exercises) {
      const point: ProgressPoint = {
        date: workout.date,
        reps: totalReps(log.sets),
        volume: volumeOf(log.sets),
        topSet: Math.max(...log.sets.map((set) => set.reps)),
        weight: lastWeight(log.sets),
      };
      (progress[log.id] ??= []).push(point);
      if (workout.date < date) {
        lastByExercise[log.id] = { date: workout.date, log };
      }
    }
  }

  return {
    exercises: catalog,
    today: await readWorkout(date, catalog),
    activity,
    progress,
    lastByExercise,
  };
}

export async function recentWorkouts(before: string, limit = 8) {
  const catalog = await listExercises();
  const dates = (await listWorkoutDates())
    .filter((day) => day <= before)
    .slice(-limit);
  return Promise.all(dates.map((day) => readWorkout(day, catalog)));
}


