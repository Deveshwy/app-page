import { daysBetween, formatPretty } from "./dates";
import { formatSets, formatTarget, lastWeight, totalReps } from "./format";
import type { CoachResult, Exercise, ExerciseLog, Goal, Workout } from "./types";

const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-5.6-luna";

const SYSTEM_PROMPT = `You are this person's home-gym trainer. They train with dumbbells at home. A bench and adjustable bells are coming; until then, no barbells, no machines, no cable work.

Tone: calm, specific, standing next to them. One-sentence why. No hype, no emojis, no markdown, no lectures.

Progressive overload (tiny):
- Compounds (shoulder-press, bench-press, dumbbell-row, goblet-squat, rdl): 3 sets of 8–12. If they hit 3×12, next time +2.5lb and 3×8. Never prescribe 13+ on a compound.
- Isolations (lateral-raise, bicep-curl, hammer-curl, forearm-curl, tricep-extension): 3 sets of 10–15 is fine. Add 1–2 reps before adding weight.
- If they only logged 1–2 sets, the goal is 3 even sets, not a bigger single set.
- If sets dropped off (17 then 10), prescribe even sets around the typical/lower working number, not the opener.
- If sets were messy (12, 8, 14, 13), clean up to 3 even sets around the median, rounded to 10 or 12, not 13.
- Week+ off: same weight, cleaner sets. Do not chase a PR.
- Never invent a weight. If history has no lb, weight is null and targetLabel has no @.
- If "Already logged today" is "(nothing)", do not mention sets they did today. Do not copy weights from the example JSON.

JSON only:
{
  "headline": "one sentence for the whole session",
  "goals": [
    {
      "exerciseId": "shoulder-press",
      "targetLabel": "3 × 10",
      "why": "cites the last date and numbers",
      "sets": 3,
      "reps": 10,
      "weight": null
    }
  ]
}

Goal list:
- 3–4 goals.
- Start with the lifts from the latest session (skip any already finished today).
- If a lift is mid-way today, prescribe only the remaining sets.
- If legs or back are missing from the last 3 sessions, last goal is ONE optional: goblet-squat, rdl, or dumbbell-row. why must start with "Optional:"
- exerciseId must come from the catalog.`;

function findLastLog(workouts: Workout[], exerciseId: string, before: string) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const workout = workouts[i];
    if (workout.date >= before) continue;
    const log = workout.exercises.find((item) => item.id === exerciseId);
    if (log) return { date: workout.date, log };
  }
  return null;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function suggestFromLast(log: ExerciseLog): Pick<Goal, "sets" | "reps" | "weight" | "targetLabel" | "why"> {
  const weight = lastWeight(log.sets);
  const n = log.sets.length;
  const reps = log.sets.map((set) => set.reps);
  const avg = mean(reps);
  const min = Math.min(...reps);
  const bump = weight != null && weight >= 40 ? 5 : 2.5;

  if (n >= 3 && min >= 12 && weight != null) {
    return {
      sets: 3,
      reps: 8,
      weight: weight + bump,
      targetLabel: formatTarget(3, 8, weight + bump),
      why: `Last time ${formatSets(log.sets)}. You owned 12s — add ${bump}lb and start over at 8s.`,
    };
  }

  if (n < 3) {
    const targetReps = Math.min(12, Math.max(8, Math.round(avg)));
    return {
      sets: 3,
      reps: targetReps,
      weight,
      targetLabel: formatTarget(3, targetReps, weight),
      why: `Only ${n} set${n === 1 ? "" : "s"} last time. Same weight, fill in 3 × ${targetReps}.`,
    };
  }

  if (avg >= 10) {
    const targetReps = Math.min(12, Math.round(avg) + 1);
    return {
      sets: n,
      reps: targetReps,
      weight,
      targetLabel: formatTarget(n, targetReps, weight),
      why: `Last time ${formatSets(log.sets)}. Keep the weight, chase ${targetReps} on every set.`,
    };
  }

  const targetReps = Math.max(8, Math.round(avg) + 2);
  return {
    sets: Math.max(3, n),
    reps: targetReps,
    weight,
    targetLabel: formatTarget(Math.max(3, n), targetReps, weight),
    why: `Last time ${formatSets(log.sets)}. Stay at this weight until the sets look like ${targetReps}.`,
  };
}

function headlineFor(date: string, recent: Workout[], today: Workout, goals: Goal[]) {
  const previous = [...recent].reverse().find((workout) => workout.date < date);
  if (today.exercises.length) {
    const done = today.exercises.reduce((sum, log) => sum + totalReps(log.sets), 0);
    return `Logged ${done} reps so far. Hit the remaining goals or stop while it still looks clean.`;
  }
  if (!previous) {
    return "First session on file. 3 sets each, leave 1–2 reps in the tank, write the numbers down.";
  }
  const gap = daysBetween(previous.date, date);
  if (gap >= 7) {
    return `${gap} days since ${formatPretty(previous.date)}. Same lifts, beat those numbers.`;
  }
  if (gap <= 1) {
    return `Back at it. Slight overload on ${goals.length} lifts.`;
  }
  return `Last session ${formatPretty(previous.date)}. Here's the bump.`;
}

export function rulesCoach(
  date: string,
  catalog: Exercise[],
  recent: Workout[],
  today: Workout,
): CoachResult {
  const previous = [...recent].reverse().find((workout) => workout.date < date);
  const focusIds = previous?.exercises.map((log) => log.id) ??
    catalog.slice(0, 4).map((exercise) => exercise.id);

  const goals: Goal[] = [];
  for (const id of focusIds.slice(0, 4)) {
    const exercise = catalog.find((item) => item.id === id);
    if (!exercise) continue;
    const last = findLastLog(recent, id, date);
    if (!last) {
      goals.push({
        exerciseId: id,
        lastLabel: "no history",
        targetLabel: "3 × 10",
        why: "No log yet. Start at a weight you can hold for 3 × 10.",
        sets: 3,
        reps: 10,
        weight: null,
      });
      continue;
    }
    const suggestion = suggestFromLast(last.log);
    goals.push({
      exerciseId: id,
      lastLabel: `${formatSets(last.log.sets)} · ${formatPretty(last.date)}`,
      ...suggestion,
    });
  }

  const hasLegs = recent.some((workout) =>
    workout.exercises.some((log) => {
      const meta = catalog.find((item) => item.id === log.id);
      return meta?.group === "legs";
    }),
  );

  let headline = headlineFor(date, recent, today, goals);
  if (!hasLegs && catalog.some((exercise) => exercise.id === "goblet-squat")) {
    headline += " Legs haven't shown up — goblet squat is sitting there.";
  }

  return {
    source: "rules",
    headline,
    goals,
  };
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1)) as {
    headline?: string;
    goals?: Array<{
      exerciseId?: string;
      targetLabel?: string;
      why?: string;
      sets?: number;
      reps?: number;
      weight?: number | null;
    }>;
  };
}

function formatWorkoutBlock(workout: Workout) {
  if (!workout.exercises.length) return "(nothing)";
  return workout.exercises
    .map((log) => `  ${log.name}: ${formatSets(log.sets)}`)
    .join("\n");
}

function userPrompt(
  date: string,
  catalog: Exercise[],
  recent: Workout[],
  today: Workout,
) {
  const previous = [...recent].reverse().find((workout) => workout.date < date);
  const gap = previous ? daysBetween(previous.date, date) : null;
  const catalogLines = catalog
    .map((exercise) => `${exercise.id} — ${exercise.name} (${exercise.group})`)
    .join("\n");
  const history = recent
    .filter((workout) => workout.date < date)
    .map((workout) => `${workout.date}\n${formatWorkoutBlock(workout)}`)
    .join("\n\n");

  const gapLine =
    gap == null
      ? "No previous session on file."
      : `${gap} day${gap === 1 ? "" : "s"} since the last session (${previous?.date}).`;

  return `Today is ${date}. ${gapLine}

Catalog:
${catalogLines}

History (oldest first):
${history || "(none)"}

Already logged today:
${formatWorkoutBlock(today)}

Write today's goals.`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function knownWeight(last: ExerciseLog | undefined, todayLog: ExerciseLog | undefined) {
  return lastWeight(todayLog?.sets ?? []) ?? lastWeight(last?.sets ?? []) ?? null;
}

function stripInventedWeight(label: string, weight: number | null) {
  if (weight != null) return label;
  return label.replace(/\s*@\s*[\d.]+(?:lb|lbs|kg)?/gi, "").trim();
}

function hydrateGoals(
  parsed: ReturnType<typeof extractJson>,
  catalog: Exercise[],
  recent: Workout[],
  today: Workout,
  date: string,
) {
  return (parsed.goals ?? [])
    .map((goal) => {
      const id = goal.exerciseId ?? "";
      const exercise = catalog.find((item) => item.id === id);
      if (!exercise) return null;
      const last = findLastLog(recent, id, date);
      const todayLog = today.exercises.find((item) => item.id === id);
      const sets = clamp(Math.round(Number(goal.sets) || 3), 1, 6);
      const reps = clamp(Math.round(Number(goal.reps) || 10), 1, 30);
      const known = knownWeight(last?.log, todayLog);
      const proposed = Number(goal.weight);
      const weight =
        known == null
          ? null
          : Number.isFinite(proposed) && proposed > 0
            ? proposed
            : known;
      const label =
        stripInventedWeight(goal.targetLabel?.trim() || "", weight) ||
        formatTarget(sets, reps, weight);
      return {
        exerciseId: id,
        lastLabel: last
          ? `${formatSets(last.log.sets)} · ${formatPretty(last.date)}`
          : "no history",
        targetLabel: label,
        why: (goal.why || "").trim() || "Beat last time by a little.",
        sets,
        reps,
        weight,
      } satisfies Goal;
    })
    .filter((goal): goal is Goal => Boolean(goal))
    .slice(0, 4);
}

export async function lunaCoach(
  date: string,
  catalog: Exercise[],
  recent: Workout[],
  today: Workout,
): Promise<CoachResult | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const fallback = rulesCoach(date, catalog, recent, today);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Workout tracker",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        reasoning: { effort: "low" },
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(date, catalog, recent, today) },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[coach] openrouter", response.status, body.slice(0, 400));
      return fallback;
    }

    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[coach] empty luna content", payload.model);
      return fallback;
    }

    const parsed = extractJson(content);
    const goals = hydrateGoals(parsed, catalog, recent, today, date);
    if (!goals.length) {
      console.error("[coach] luna returned no usable goals", content.slice(0, 400));
      return fallback;
    }

    return {
      source: "luna",
      headline: parsed.headline?.trim() || fallback.headline,
      goals,
    };
  } catch (error) {
    console.error("[coach] luna failed", error);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
