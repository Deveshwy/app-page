# Workout

Personal dumbbell tracker. Two jobs: **show up**, and **beat last time**.

Logs are markdown files on disk — same idea as Apple Notes, plus a date picker, exercise photos, a GitHub-style heatmap, and a coach that pushes progressive overload.

## Run it

```bash
cp .env.example .env.local   # paste your OpenRouter key if you want Luna
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Logging

1. Date defaults to today. Click the heatmap or arrows to jump.
2. Click an exercise photo (or a goal chip).
3. Type weight + reps, hit enter / **add set**.
4. Sets stack like your notes: `17 + 10 = 27`.
5. Click a number to undo that set.

Daily total is the gold number under TODAY.

## Files (the database)

```
data/exercises.md              catalog + cues + image paths
data/workouts/YYYY-MM-DD.md    one file per session
```

Example:

```markdown
# 2026-08-13

- Shoulder Press: 17 + 10 = 27 @ 20
- Lateral Raise: 12 + 8 + 14 + 13 = 47 @ 10
- Bicep Curl: 12

total: 86
```

Edit these in any text editor. Refresh the page and the app picks it up.

Add a lift in the UI (`+`) or by appending a `## Name` block to `exercises.md`.

## Coach

Numbers come from TypeScript (`src/lib/overload.ts`). Luna only writes the headline and the one-line why.

Without a key, you still get the same targets — just drier copy.

With a key, it calls [GPT-5.6 Luna](https://openrouter.ai/openai/gpt-5.6-luna) via OpenRouter. Copy is cached in `data/.cache/` from the date + locked targets, so logging sets mid-session does not mutate the plan (the chips already show `1/3`).

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-5.6-luna
```

Rules the engine actually enforces:

- Compounds (press, bench, row, squat, rdl): 3 × 8–12. Clean 3×12 at a logged weight and you trained this week → 3×8 a notch heavier. A week+ off → same weight, even sets, no bump.
- Isolations: 3 × 10–15. Add reps before weight.
- Messy or drop-off sets (17 then 10, or 12/8/14/13) → even working number, never chase the opener, never invent 13s.
- No weight in the log → no `@ lb` on the target. Luna is not allowed to invent one.

Keep `.env.local` on your machine. Never commit it.

## Stack

Next.js 14, React, Tailwind. No hosted database.
