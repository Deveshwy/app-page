import { daysBetween, formatPretty } from "./dates";
import { formatSets, formatTarget, lastWeight, totalReps } from "./format";
import type { CoachResult, Exercise, ExerciseLog, Goal, Workout } from "./types";

const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-5.6-luna";

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
    const targetReps = Math.max(10, Math.round(avg));
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
  if (!hasLegs && catalog.some((exercise) => exercise.id === "goblet-squat")) {
    const first = goals[0];
    if (first) {
      first.why += " (legs are untouched — goblet squat whenever you have 10 minutes)";
    }
  }

  return {
    source: "rules",
    headline: headlineFor(date, recent, today, goals),
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

export async function lunaCoach(
  date: string,
  catalog: Exercise[],
  recent: Workout[],
  today: Workout,
): Promise<CoachResult | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const fallback = rulesCoach(date, catalog, recent, today);
  const history = recent
    .map((workout) => {
      const lines = workout.exercises
        .map((log) => `  ${log.name}: ${formatSets(log.sets)}`)
        .join("\n");
      return `${workout.date}\n${lines}`;
    })
    .join("\n\n");

  const catalogLines = catalog
    .map((exercise) => `${exercise.id} (${exercise.name}, ${exercise.group})`)
    .join(", ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

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
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are a terse home-gym trainer. Dumbbells only, maybe a bench. Progressive overload: add 1–2 reps or 2.5lb, never both wildly. Prefer 3 sets of 8–12. Talk like a person, not an app. Reply JSON only.",
          },
          {
            role: "user",
            content: `Today is ${date}.
Exercises (use these ids): ${catalogLines}

Recent sessions:
${history || "(none)"}

Already logged today:
${
  today.exercises.length
    ? today.exercises.map((log) => `${log.name}: ${formatSets(log.sets)}`).join("\n")
    : "(nothing yet)"
}

Return JSON:
{
  "headline": "one short trainer sentence",
  "goals": [
    {
      "exerciseId": "shoulder-press",
      "targetLabel": "3 × 12 @ 20lb",
      "why": "one sentence",
      "sets": 3,
      "reps": 12,
      "weight": 20
    }
  ]
}

Max 4 goals. Mostly the lifts they already do. Do not invent barbell or machine work.`,
          },
        ],
      }),
    });

    if (!response.ok) return fallback;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const parsed = extractJson(content);
    const goals = (parsed.goals ?? [])
      .map((goal) => {
        const id = goal.exerciseId ?? "";
        const exercise = catalog.find((item) => item.id === id);
        if (!exercise) return null;
        const last = findLastLog(recent, id, date);
        const sets = Number(goal.sets) || 3;
        const reps = Number(goal.reps) || 10;
        const weight = goal.weight ?? lastWeight(last?.log.sets ?? []) ?? null;
        return {
          exerciseId: id,
          lastLabel: last
            ? `${formatSets(last.log.sets)} · ${formatPretty(last.date)}`
            : "no history",
          targetLabel: goal.targetLabel || formatTarget(sets, reps, weight),
          why: (goal.why || "").trim() || "Beat last time by a little.",
          sets,
          reps,
          weight,
        } satisfies Goal;
      })
      .filter((goal): goal is Goal => Boolean(goal))
      .slice(0, 4);

    if (!goals.length) return fallback;
    return {
      source: "luna",
      headline: parsed.headline?.trim() || fallback.headline,
      goals,
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
