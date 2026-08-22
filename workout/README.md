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

Without a key, a local rule engine does double progression (fill in 3 sets, add reps, then add 2.5 lb).

With a key, it calls [GPT-5.6 Luna](https://openrouter.ai/openai/gpt-5.6-luna) via OpenRouter:

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-5.6-luna
```

Keep `.env.local` on your machine. Never commit it.

## Stack

Next.js 14, React, Tailwind. No hosted database.
