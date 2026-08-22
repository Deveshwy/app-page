# Workout

Minimal dumbbell tracker. Two jobs: **show up**, and **beat last time**.

Logs live as markdown files on disk — same idea as the Notes app, just with a date picker, photos, a GitHub-style heatmap, and a coach that pushes progressive overload.

## Run it

```bash
cd workout
cp .env.example .env.local   # optional, for the AI coach
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Logging

1. Pick a date (defaults to today).
2. Click an exercise photo.
3. Type weight + reps, hit enter / **add set**.
4. Multiple sets stack like your notes: `17 + 10 = 27`.
5. Click a number to undo that set.

That's it. Daily total is the gold number at the bottom of the log.

## Files (the database)

```
workout/data/exercises.md          catalog + cues + image paths
workout/data/workouts/YYYY-MM-DD.md
```

Example session:

```markdown
# 2026-08-13

- Shoulder Press: 17 + 10 = 27 @ 20
- Lateral Raise: 12 + 8 + 14 + 13 = 47 @ 10
- Bicep Curl: 12

total: 86
```

You can edit these in any text editor. Refresh the page and the app picks it up.

Add a lift in the UI (the dashed tile) or by appending a `## Name` block to `exercises.md`.

## Coach

Without an API key, a local rule engine does double progression:

- under 3 sets → fill in 3
- 8–11 reps → add reps
- 3×12 → add 2.5 lb and drop back to 8s

With a key, it calls [GPT-5.6 Luna](https://openrouter.ai/openai/gpt-5.6-luna) via OpenRouter and talks like a trainer instead.

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-5.6-luna
```

Get a key at [openrouter.ai](https://openrouter.ai). Luna is the cheap tier. If the call fails, it falls back to the local rules so logging never blocks.

## Heatmap + progress

The grid is one year of sessions, gold = more total reps that day. Click a square to open that log.

Pick an exercise to see its reps-over-time line. Same lifts as Jun 27 / Aug 10 / Aug 13 are already seeded from your notes (no weights, because those weren't written down).

## Stack

Next.js 14, React, Tailwind. No real database. `data/` is git-friendly if you want history as a backup.
