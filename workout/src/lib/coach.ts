import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  ACCESSORY_IDS,
  ENGINE_VERSION,
  buildPlan,
  describeCard,
  sessionHeadline,
  swapOptional,
  type LiftCard,
} from "./overload";
import type { CoachResult, Exercise, Goal, Workout } from "./types";

export const COACH_PROMPT_VERSION = 3;
const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-5.6-luna";
const CACHE_DIR = path.join(process.cwd(), "data/.cache");

const SYSTEM_PROMPT = `You are this person's home-gym coach. They train with dumbbells at home. A bench and adjustable bells are coming; until then: no barbells, no machines, no cables.

YOUR JOB IS COPY ONLY. TypeScript already locked sets, reps, and weight for every lift. You do not choose numbers. You do not do arithmetic. You do not "fix" the plan.

Tone: calm, specific, standing next to them. No hype, no emojis, no markdown, no lectures.

Copy rules:
- headline: one sentence for the whole session.
- why: one sentence per lift. Cite the last date and the actual logged set string.
- Never mention a weight unless that lift's locked target includes one. If weight is none, do not invent lb.
- Never tell them a different set/rep scheme than the locked target.
- Never shrink a target to "remaining" sets. The UI already tracks 1/3, 2/3. Always talk about the full session (e.g. 3 × 10).
- Optional lifts: start why with "Optional:".
- You may swap ONLY the optional accessory to another of: goblet-squat, rdl, dumbbell-row. Do not swap or drop the main lifts.

Progressive overload (already applied in the locked numbers — just so you don't argue with them):
- Compounds 8–12. Clean 3×12 at a known weight AND <7 days off → next time 3×8 a notch heavier. A week+ off → same weight, even sets around 10. Do not add weight after a layoff.
- Isolations 10–15. Add reps before weight.
- Drop-off (17 then 10) or messy sets (12, 8, 14, 13) → even sets at a snapped working number (10/12, never 13, never chase the opener).
- 1–2 sets last time → fill to 3 even sets, not a bigger single.

BAD (never do this):
Last: Shoulder Press 17 + 10 on Aug 13, 9 days off, no weight logged.
→ "3 × 14 @ 20lb — go beat that 17"

GOOD:
→ why: "Nine days off after 17 + 10 on Aug 13. Three even tens — don't chase the opener, and don't invent a load."

BAD: messy laterals 12 + 8 + 14 + 13 → prescribe 13s or the 14.
GOOD: even 12s, whatever the locked target says.

Return JSON only:
{
  "headline": "one sentence",
  "goals": [{ "exerciseId": "shoulder-press", "why": "one sentence" }]
}`;

const COPY_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "coach_copy",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: { type: "string" },
        goals: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              exerciseId: { type: "string" },
              why: { type: "string" },
            },
            required: ["exerciseId", "why"],
          },
        },
      },
      required: ["headline", "goals"],
    },
  },
};

type LunaCopy = {
  headline: string;
  goals: Array<{ exerciseId: string; why: string }>;
};

export function rulesCoach(
  date: string,
  catalog: Exercise[],
  recent: Workout[],
): CoachResult {
  const { cards, goals } = buildPlan(catalog, recent, date);
  return {
    source: "rules",
    headline: sessionHeadline(cards, goals),
    goals,
  };
}

function extractJson(text: string): LunaCopy {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    headline?: string;
    goals?: Array<{ exerciseId?: string; why?: string }>;
  };
  return {
    headline: (parsed.headline ?? "").trim(),
    goals: (parsed.goals ?? [])
      .map((goal) => ({
        exerciseId: (goal.exerciseId ?? "").trim(),
        why: (goal.why ?? "").trim(),
      }))
      .filter((goal) => goal.exerciseId && goal.why),
  };
}

function sanitizeWhy(why: string, weight: number | null) {
  let next = why.replace(/\s+/g, " ").trim();
  if (weight == null) {
    next = next
      .replace(/\s*@\s*[\d.]+(?:\s*(?:lb|lbs|kg))?/gi, "")
      .replace(/\b[\d.]+(?:\s*)(?:lb|lbs)\b/gi, "weight");
  }
  return next.replace(/\s{2,}/g, " ").trim();
}

function cacheKey(date: string, goals: Goal[]) {
  const payload = JSON.stringify({
    v: ENGINE_VERSION,
    prompt: COACH_PROMPT_VERSION,
    date,
    model: MODEL,
    goals: goals.map((goal) => ({
      id: goal.exerciseId,
      sets: goal.sets,
      reps: goal.reps,
      weight: goal.weight,
      action: goal.action,
    })),
  });
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `coach-${date}-${hash}.json`);
}

async function readCache(file: string): Promise<LunaCopy | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as LunaCopy;
    if (!parsed.headline || !Array.isArray(parsed.goals)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(file: string, copy: LunaCopy) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(copy), "utf8");
  await fs.rename(tmp, file);
}

function userPrompt(date: string, cards: LiftCard[], goals: Goal[]) {
  const newest = cards
    .map((card) => card.last)
    .filter(Boolean)
    .sort((a, b) => (b?.date ?? "").localeCompare(a?.date ?? ""))[0];
  const gap = newest
    ? `${newest.daysAgo} day${newest.daysAgo === 1 ? "" : "s"} since ${newest.date}.`
    : "No previous session on file.";

  const locked = goals
    .map((goal, index) => {
      const card = cards[index];
      const weight = goal.weight == null ? "none — do not invent one" : String(goal.weight);
      return `${describeCard(card)}
  LOCKED TARGET: ${goal.sets} × ${goal.reps} | weight=${weight} | action=${goal.action}
  (sets/reps/weight are immutable)`;
    })
    .join("\n\n");

  return `Today is ${date}. ${gap}

LOCKED SESSION (do not change the numbers):
${locked}

Write headline + a why for each locked exerciseId. Keep every why aligned with that lift's action and locked target.`;
}

function mergeCopy(
  date: string,
  catalog: Exercise[],
  recent: Workout[],
  cards: LiftCard[],
  goals: Goal[],
  copy: LunaCopy,
): CoachResult {
  const accessorySwap = copy.goals.find((goal) =>
    (ACCESSORY_IDS as readonly string[]).includes(goal.exerciseId) &&
    !goals.some((item) => item.exerciseId === goal.exerciseId),
  );
  let nextGoals = goals;
  let nextCards = cards;
  if (accessorySwap) {
    const swapped = swapOptional(
      goals,
      cards,
      catalog,
      recent,
      date,
      accessorySwap.exerciseId,
    );
    nextGoals = swapped.goals;
    nextCards = swapped.cards;
  }

  const whyById = new Map(copy.goals.map((goal) => [goal.exerciseId, goal.why]));
  const fallbackHeadline = sessionHeadline(nextCards, nextGoals);
  const anyWeight = nextGoals.some((goal) => goal.weight != null);

  return {
    source: "luna",
    headline: sanitizeWhy(copy.headline || fallbackHeadline, anyWeight ? 1 : null),
    goals: nextGoals.map((goal) => ({
      ...goal,
      why: sanitizeWhy(whyById.get(goal.exerciseId) || goal.why, goal.weight),
    })),
  };
}

async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  responseFormat: unknown,
  signal: AbortSignal,
) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
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
      response_format: responseFormat,
      messages,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    return { ok: false as const, status: response.status, body };
  }

  const payload = JSON.parse(body) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return { ok: false as const, status: 200, body: "empty content" };
  return { ok: true as const, content };
}

export async function lunaCoach(
  date: string,
  catalog: Exercise[],
  recent: Workout[],
): Promise<CoachResult> {
  const { cards, goals } = buildPlan(catalog, recent, date);
  const fallback: CoachResult = {
    source: "rules",
    headline: sessionHeadline(cards, goals),
    goals,
  };

  if (!process.env.OPENROUTER_API_KEY) return fallback;

  const file = cacheKey(date, goals);
  const cached = await readCache(file);
  if (cached) return mergeCopy(date, catalog, recent, cards, goals, cached);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt(date, cards, goals) },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    let result = await callOpenRouter(messages, COPY_SCHEMA, controller.signal);
    if (result && !result.ok && (result.status === 400 || result.status === 422)) {
      console.error("[coach] json_schema rejected, retrying json_object", result.body.slice(0, 300));
      result = await callOpenRouter(
        messages,
        { type: "json_object" },
        controller.signal,
      );
    }

    if (!result) return fallback;
    if (!result.ok) {
      console.error("[coach] openrouter", result.status, result.body.slice(0, 400));
      return fallback;
    }

    const parsed = extractJson(result.content);
    if (!parsed.goals.length) {
      console.error("[coach] luna returned no copy", result.content.slice(0, 400));
      return fallback;
    }

    await writeCache(file, parsed);
    return mergeCopy(date, catalog, recent, cards, goals, parsed);
  } catch (error) {
    console.error("[coach] luna failed", error);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
