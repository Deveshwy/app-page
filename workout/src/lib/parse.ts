import { formatNum, slugify, totalReps } from "./format";
import { kindOf } from "./overload";
import type { Exercise, ExerciseLog, LiftKind, SetEntry, Workout } from "./types";

const SET_TOKEN =
  /^(\d+(?:\.\d+)?)\s*(?:@\s*([\d.]+)\s*(?:lb|lbs|kg)?)?$/i;

export function parseWorkout(date: string, markdown: string): Workout {
  const exercises: ExerciseLog[] = [];

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("- ")) continue;
    const sliced = line.slice(2);
    const colon = sliced.indexOf(":");
    if (colon === -1) continue;

    const name = sliced.slice(0, colon).trim();
    const rest = sliced.slice(colon + 1).trim();
    if (!name || !rest) continue;

    const sets = parseSets(rest);
    if (!sets.length) continue;

    exercises.push({
      id: slugify(name),
      name,
      sets,
    });
  }

  return { date, exercises };
}

export function parseSets(rest: string): SetEntry[] {
  let work = rest.trim().replace(/=\s*[\d.]+/g, " ");
  work = work.replace(/\s+/g, " ").trim();

  const atCount = (work.match(/@/g) ?? []).length;
  let shared: number | null = null;
  if (atCount <= 1) {
    const trailing = work.match(/^(.*?)\s*@\s*([\d.]+)\s*(?:lb|lbs|kg)?\s*$/i);
    if (trailing) {
      work = trailing[1].trim();
      shared = Number(trailing[2]);
    }
  }

  return work
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((token) => {
      const match = token.match(SET_TOKEN);
      if (!match) return [];
      const reps = Number(match[1]);
      const weight = match[2] != null ? Number(match[2]) : shared;
      if (!Number.isFinite(reps) || reps <= 0) return [];
      return [{ reps, weight: Number.isFinite(weight) ? weight : null }];
    });
}

export function stringifyWorkout(workout: Workout) {
  const lines = [`# ${workout.date}`, ""];

  for (const exercise of workout.exercises) {
    lines.push(`- ${exercise.name}: ${formatExerciseSets(exercise.sets)}`);
  }

  const total = workout.exercises.reduce(
    (sum, exercise) => sum + totalReps(exercise.sets),
    0,
  );
  if (workout.exercises.length) {
    lines.push("", `total: ${total}`);
  }

  return `${lines.join("\n")}\n`;
}

function formatExerciseSets(sets: SetEntry[]) {
  const total = totalReps(sets);
  const mixed = sets.some((set) => set.weight !== sets[0].weight);

  if (mixed) {
    const parts = sets.map((set) =>
      set.weight != null ? `${set.reps}@${formatNum(set.weight)}` : String(set.reps),
    );
    return sets.length > 1 ? `${parts.join(" + ")} = ${total}` : parts[0];
  }

  const reps = sets.map((set) => set.reps).join(" + ");
  const weight = sets[0]?.weight;
  const withTotal = sets.length > 1 ? `${reps} = ${total}` : reps;
  return weight != null ? `${withTotal} @ ${formatNum(weight)}` : withTotal;
}

export function parseExercises(markdown: string): Exercise[] {
  const blocks = markdown.split(/^## /m).slice(1);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const name = (lines[0] ?? "").trim();
    const fields: Record<string, string> = {};
    for (const line of lines.slice(1)) {
      const match = line.match(/^([a-zA-Z]+):\s*(.*)$/);
      if (match) fields[match[1].toLowerCase()] = match[2].trim();
    }

    const aliases = (fields.aliases ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const parsedKind: LiftKind | undefined =
      fields.kind === "compound" || fields.kind === "isolation"
        ? fields.kind
        : undefined;
    const id = fields.id || slugify(name);

    return {
      id,
      name,
      group: fields.group || "other",
      kind: kindOf({ id, kind: parsedKind }),
      image: fields.image || null,
      cue: fields.cue || "",
      aliases,
    };
  });
}

export function stringifyNewExercise(exercise: Exercise) {
  const lines = [
    "",
    `## ${exercise.name}`,
    `id: ${exercise.id}`,
    `group: ${exercise.group}`,
    `kind: ${exercise.kind}`,
  ];
  if (exercise.image) lines.push(`image: ${exercise.image}`);
  if (exercise.cue) lines.push(`cue: ${exercise.cue}`);
  if (exercise.aliases.length) {
    lines.push(`aliases: ${exercise.aliases.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function resolveExerciseId(name: string, catalog: Exercise[]) {
  const slug = slugify(name);
  const found = catalog.find(
    (exercise) =>
      exercise.id === slug ||
      slugify(exercise.name) === slug ||
      exercise.aliases.some((alias) => slugify(alias) === slug),
  );
  return found?.id ?? slug;
}

export function attachCatalog(workout: Workout, catalog: Exercise[]): Workout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => {
      const id = resolveExerciseId(exercise.name, catalog);
      const meta = catalog.find((item) => item.id === id);
      return {
        ...exercise,
        id,
        name: meta?.name ?? exercise.name,
      };
    }),
  };
}
