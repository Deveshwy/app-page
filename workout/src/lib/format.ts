import type { SetEntry } from "./types";

export function formatNum(n: number) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export function totalReps(sets: SetEntry[]) {
  return sets.reduce((sum, set) => sum + set.reps, 0);
}

export function volumeOf(sets: SetEntry[]) {
  return sets.reduce((sum, set) => sum + set.reps * (set.weight ?? 1), 0);
}

export function sharedWeight(sets: SetEntry[]) {
  if (!sets.length) return null;
  const first = sets[0].weight;
  return sets.every((set) => set.weight === first) ? first : null;
}

export function lastWeight(sets: SetEntry[]) {
  for (let i = sets.length - 1; i >= 0; i--) {
    if (sets[i].weight != null) return sets[i].weight;
  }
  return null;
}

export function formatSets(sets: SetEntry[]) {
  if (!sets.length) return "";
  const shared = sharedWeight(sets);
  const mixed = sets.some((set) => set.weight !== sets[0].weight);

  if (mixed) {
    return sets
      .map((set) =>
        set.weight != null ? `${set.reps}@${formatNum(set.weight)}` : String(set.reps),
      )
      .join(" + ");
  }

  const reps = sets.map((set) => set.reps).join(" + ");
  if (shared != null) return `${reps} @ ${formatNum(shared)}lb`;
  return reps;
}

export function formatTarget(sets: number, reps: number, weight: number | null) {
  const scheme = `${sets} × ${reps}`;
  return weight != null ? `${scheme} @ ${formatNum(weight)}lb` : scheme;
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
