import { daysBetween, formatPretty } from "./dates";
import { formatSets, formatTarget, formatNum, lastWeight } from "./format";
import type {
  CoachAction,
  Exercise,
  Goal,
  LiftKind,
  SetEntry,
  Workout,
} from "./types";

export const ENGINE_VERSION = 2;

export const COMPOUND_IDS = new Set([
  "shoulder-press",
  "bench-press",
  "dumbbell-row",
  "goblet-squat",
  "rdl",
]);

export const ACCESSORY_IDS = ["goblet-squat", "rdl", "dumbbell-row"] as const;

export type Range = { min: number; max: number };

export type SetStats = {
  sets: number;
  min: number;
  max: number;
  median: number;
  avg: number;
  dropOff: number;
  spread: number;
  even: boolean;
  total: number;
  weight: number | null;
};

export type LastLift = {
  date: string;
  daysAgo: number;
  stats: SetStats;
  sets: SetEntry[];
};

export type LiftCard = {
  exerciseId: string;
  name: string;
  kind: LiftKind;
  range: Range;
  last: LastLift | null;
  previous: LastLift | null;
};

export function kindOf(exercise: Pick<Exercise, "id"> & { kind?: LiftKind }): LiftKind {
  if (exercise.kind === "compound" || exercise.kind === "isolation") {
    return exercise.kind;
  }
  return COMPOUND_IDS.has(exercise.id) ? "compound" : "isolation";
}

export function rangeFor(kind: LiftKind): Range {
  return kind === "compound" ? { min: 8, max: 12 } : { min: 10, max: 15 };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function statsOf(sets: SetEntry[]): SetStats {
  const reps = sets.map((set) => set.reps);
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  const total = reps.reduce((sum, n) => sum + n, 0);
  return {
    sets: reps.length,
    min,
    max,
    median: median(reps),
    avg: Math.round((total / reps.length) * 10) / 10,
    dropOff: reps[0] - reps[reps.length - 1],
    spread: max - min,
    even: max - min <= 1,
    total,
    weight: lastWeight(sets),
  };
}

export function historyFor(
  exerciseId: string,
  workouts: Workout[],
  today: string,
): { last: LastLift | null; previous: LastLift | null } {
  const hits: LastLift[] = [];
  const past = workouts
    .filter((workout) => workout.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const workout of past) {
    const lift = workout.exercises.find((item) => item.id === exerciseId);
    if (!lift || lift.sets.length === 0) continue;
    hits.push({
      date: workout.date,
      daysAgo: daysBetween(workout.date, today),
      stats: statsOf(lift.sets),
      sets: lift.sets,
    });
    if (hits.length === 2) break;
  }
  return { last: hits[0] ?? null, previous: hits[1] ?? null };
}

export function clampReps(kind: LiftKind, n: number) {
  const { min, max } = rangeFor(kind);
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Snap messy working numbers onto the progression ladder. Rounds down on a tie. */
export function snapReps(kind: LiftKind, n: number) {
  const anchors = kind === "compound" ? [8, 10, 12] : [10, 12, 15];
  const clamped = clampReps(kind, n);
  const below = anchors.filter((anchor) => anchor <= clamped);
  return below.length ? below[below.length - 1] : anchors[0];
}

function nextWeight(current: number) {
  return current >= 40 ? current + 5 : current + 2.5;
}

function lb(weight: number | null) {
  return weight != null ? ` @ ${formatNum(weight)}lb` : "";
}

function cleanTopSet(stats: SetStats, kind: LiftKind) {
  return stats.sets >= 3 && stats.even && stats.min >= rangeFor(kind).max;
}

export type Planned = {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number | null;
  action: CoachAction;
  why: string;
};

export function planLift(card: LiftCard): Planned {
  const { min, max } = card.range;
  const last = card.last;

  if (!last) {
    return {
      exerciseId: card.exerciseId,
      sets: 3,
      reps: min,
      weight: null,
      action: "first_time",
      why: `First log for ${card.name}. Three even sets at ${min} — learn the movement, don't chase a PR.`,
    };
  }

  const { stats, daysAgo } = last;
  const weight = stats.weight;

  if (daysAgo >= 7) {
    const holdReps = cleanTopSet(stats, card.kind)
      ? snapReps(card.kind, max - 2)
      : snapReps(card.kind, Math.min(stats.median, max - 2));
    return {
      exerciseId: card.exerciseId,
      sets: 3,
      reps: holdReps,
      weight,
      action: "deload",
      why: `${daysAgo} days off ${card.name}. Rebuild with 3 even × ${holdReps}${lb(weight)} — do not add weight until you're back in the groove.`,
    };
  }

  if (stats.dropOff >= 4 || stats.spread > 3) {
    const raw = stats.dropOff >= 4 ? Math.min(stats.min, stats.median) : stats.median;
    const even = snapReps(card.kind, raw);
    return {
      exerciseId: card.exerciseId,
      sets: 3,
      reps: even,
      weight,
      action: "even_up",
      why: `Last ${card.name} fell off (${stats.min}–${stats.max}). Hold${weight != null ? ` ${formatNum(weight)}lb and` : ""} hit 3 even × ${even}. Even sets beat a messy high.`,
    };
  }

  if (stats.sets < 3) {
    const reps = snapReps(card.kind, Math.min(max, Math.max(stats.median, min)));
    return {
      exerciseId: card.exerciseId,
      sets: 3,
      reps,
      weight,
      action: "fill_sets",
      why: `Last ${card.name} was only ${stats.sets} set${stats.sets === 1 ? "" : "s"}. Fill to 3 even × ${reps}${lb(weight)} before adding load.`,
    };
  }

  if (cleanTopSet(stats, card.kind) && weight != null) {
    const bumped = nextWeight(weight);
    return {
      exerciseId: card.exerciseId,
      sets: 3,
      reps: min,
      weight: bumped,
      action: "add_weight",
      why: `Clean 3×${max} @ ${formatNum(weight)}lb. Add a plate notch: 3×${min} @ ${formatNum(bumped)}lb.`,
    };
  }

  if (stats.min >= max && weight == null) {
    return {
      exerciseId: card.exerciseId,
      sets: 3,
      reps: max,
      weight: null,
      action: "hold",
      why: `Reps are at the top of the ${min}–${max} range. Log the dumbbell weight next time so we can bump load instead of chasing more reps.`,
    };
  }

  if (!stats.even) {
    const even = snapReps(card.kind, stats.median);
    return {
      exerciseId: card.exerciseId,
      sets: 3,
      reps: even,
      weight,
      action: "even_up",
      why: `Sets weren't even. Repeat 3 × ${even}${lb(weight)} and keep every set within 1 rep.`,
    };
  }

  if (stats.min < max) {
    const next = clampReps(card.kind, stats.min + 1);
    return {
      exerciseId: card.exerciseId,
      sets: 3,
      reps: next,
      weight,
      action: "add_reps",
      why: `Solid even sets. Add a rep: 3 × ${next}${lb(weight)}.`,
    };
  }

  return {
    exerciseId: card.exerciseId,
    sets: 3,
    reps: clampReps(card.kind, stats.median),
    weight,
    action: "hold",
    why: `Hold 3 × ${clampReps(card.kind, stats.median)}${lb(weight)}. Don't invent load.`,
  };
}

export function pickSession(
  exercises: Exercise[],
  workouts: Workout[],
  today: string,
): { ids: string[]; optionalId: string | null } {
  const known = new Set(exercises.map((exercise) => exercise.id));
  const past = workouts
    .filter((workout) => workout.date < today && workout.exercises.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = [...past].reverse()[0];
  const ids: string[] = [];

  if (last) {
    for (const lift of last.exercises) {
      if (ids.length >= 3) break;
      if (known.has(lift.id) && !ids.includes(lift.id)) ids.push(lift.id);
    }
  } else {
    for (const id of ["shoulder-press", "lateral-raise", "bicep-curl"]) {
      if (known.has(id)) ids.push(id);
    }
  }

  const recentIds = new Set(
    past.slice(-3).flatMap((workout) => workout.exercises.map((lift) => lift.id)),
  );
  const missing =
    ACCESSORY_IDS.find((id) => known.has(id) && !recentIds.has(id) && !ids.includes(id)) ??
    null;
  if (missing) ids.push(missing);

  return { ids, optionalId: missing };
}

export function cardFor(
  exercise: Exercise,
  workouts: Workout[],
  today: string,
): LiftCard {
  const kind = kindOf(exercise);
  const { last, previous } = historyFor(exercise.id, workouts, today);
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    kind,
    range: rangeFor(kind),
    last,
    previous,
  };
}

export function toGoal(plan: Planned, card: LiftCard): Goal {
  return {
    exerciseId: plan.exerciseId,
    lastLabel: card.last
      ? `${formatSets(card.last.sets)} · ${formatPretty(card.last.date)}`
      : "no history",
    targetLabel: formatTarget(plan.sets, plan.reps, plan.weight),
    why: plan.why,
    sets: plan.sets,
    reps: plan.reps,
    weight: plan.weight,
    action: plan.action,
  };
}

export function buildPlan(
  exercises: Exercise[],
  workouts: Workout[],
  today: string,
): { cards: LiftCard[]; goals: Goal[] } {
  const catalog = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const { ids, optionalId } = pickSession(exercises, workouts, today);
  const cards: LiftCard[] = [];
  const goals: Goal[] = [];

  for (const id of ids) {
    const exercise = catalog.get(id);
    if (!exercise) continue;
    const card = cardFor(exercise, workouts, today);
    cards.push(card);
    const planned = planLift(card);
    if (id === optionalId) {
      goals.push(
        toGoal(
          {
            ...planned,
            action: "optional",
            why: `Optional ${exercise.name} — legs/back have been missing. 3×${planned.reps}${planned.weight != null ? ` @ ${formatNum(planned.weight)}lb` : ""} if you have time. Skip if the session is already long.`,
          },
          card,
        ),
      );
    } else {
      goals.push(toGoal(planned, card));
    }
  }

  return { cards, goals };
}

export function swapOptional(
  goals: Goal[],
  cards: LiftCard[],
  catalog: Exercise[],
  workouts: Workout[],
  today: string,
  nextId: string,
): { goals: Goal[]; cards: LiftCard[] } {
  const allowed = new Set<string>(ACCESSORY_IDS);
  if (!allowed.has(nextId)) return { goals, cards };
  const exercise = catalog.find((item) => item.id === nextId);
  if (!exercise) return { goals, cards };

  const optionalAt = goals.findIndex((goal) => goal.action === "optional");
  if (optionalAt === -1) return { goals, cards };
  if (goals[optionalAt].exerciseId === nextId) return { goals, cards };
  if (goals.some((goal) => goal.exerciseId === nextId)) return { goals, cards };

  const card = cardFor(exercise, workouts, today);
  const planned = planLift(card);
  const nextGoal = toGoal(
    {
      ...planned,
      action: "optional",
      why: `Optional ${exercise.name} — legs/back have been missing. 3×${planned.reps} if you have time. Skip if the session is already long.`,
    },
    card,
  );

  const nextGoals = [...goals];
  const nextCards = [...cards];
  nextGoals[optionalAt] = nextGoal;
  nextCards[optionalAt] = card;
  return { goals: nextGoals, cards: nextCards };
}

export function sessionHeadline(cards: LiftCard[], goals: Goal[]): string {
  const lastDates = cards
    .map((card) => card.last)
    .filter((item): item is LastLift => Boolean(item));
  const newest = lastDates.sort((a, b) => b.date.localeCompare(a.date))[0];

  if (!newest) {
    return "First session on file. Three even sets each, leave a couple reps in the tank, write the numbers down.";
  }

  if (goals.some((goal) => goal.action === "deload")) {
    return `${newest.daysAgo} days since ${formatPretty(newest.date)}. Same lifts, even sets — rebuild, don't chase a PR.`;
  }
  if (goals.some((goal) => goal.action === "add_weight")) {
    return `Last session ${formatPretty(newest.date)}. Time to add a little weight on the compounds.`;
  }
  if (goals.some((goal) => goal.action === "even_up" || goal.action === "fill_sets")) {
    return `Last session ${formatPretty(newest.date)}. Clean up the sets before you add load.`;
  }
  return `Last session ${formatPretty(newest.date)}. Tiny overload — one more rep or a cleaner set.`;
}

export function actionLabel(action: CoachAction) {
  switch (action) {
    case "first_time":
      return "learn";
    case "fill_sets":
      return "fill";
    case "even_up":
      return "even sets";
    case "add_reps":
      return "+ reps";
    case "add_weight":
      return "+ weight";
    case "hold":
      return "hold";
    case "deload":
      return "rebuild";
    case "optional":
      return "optional";
  }
}

export function remainingWhy(why: string, setsLogged: number, setsTarget: number) {
  const left = Math.max(0, setsTarget - setsLogged);
  if (setsLogged > 0 && left > 0) return `${left} left. ${why}`;
  return why;
}

export function describeCard(card: LiftCard): string {
  const { min, max } = card.range;
  const last = card.last
    ? `last ${formatPretty(card.last.date)} (${card.last.date}, ${card.last.daysAgo}d): ${formatSets(card.last.sets)} | sets=${card.last.stats.sets} min=${card.last.stats.min} max=${card.last.stats.max} median=${card.last.stats.median} dropOff=${card.last.stats.dropOff} spread=${card.last.stats.spread} even=${card.last.stats.even ? "yes" : "no"} weight=${card.last.stats.weight ?? "none"}`
    : "last: none";
  const prev = card.previous
    ? `prev ${formatPretty(card.previous.date)} (${card.previous.date}): ${formatSets(card.previous.sets)}`
    : "prev: none";
  return `${card.exerciseId} [${card.kind} ${min}–${max}] ${card.name}\n  ${last}\n  ${prev}`;
}
