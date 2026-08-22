"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, formatLong, todayISO } from "@/lib/dates";
import { lastWeight, totalReps } from "@/lib/format";
import type { AppState, CoachResult } from "@/lib/types";
import ExerciseGrid from "./ExerciseGrid";
import Heatmap from "./Heatmap";
import Progress from "./Progress";
import SetForm from "./SetForm";
import TodayLog from "./TodayLog";

export default function Tracker() {
  const [date, setDate] = useState(todayISO);
  const [state, setState] = useState<AppState | null>(null);
  const [coach, setCoach] = useState<CoachResult | null>(null);
  const [coachLoading, setCoachLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ exerciseId: string; index: number } | null>(
    null,
  );

  const refresh = useCallback(async (day: string) => {
    const res = await fetch(`/api/state?date=${day}`, { cache: "no-store" });
    if (!res.ok) throw new Error("could not load workouts");
    const next = (await res.json()) as AppState;
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    let gone = false;
    setError(null);
    refresh(date)
      .then((next) => {
        if (gone) return;
        setSelected((current) => {
          if (current && next.exercises.some((exercise) => exercise.id === current)) {
            return current;
          }
          return next.today.exercises[0]?.id ?? next.exercises[0]?.id ?? null;
        });
      })
      .catch((err: Error) => {
        if (!gone) setError(err.message);
      });
    return () => {
      gone = true;
    };
  }, [date, refresh]);

  useEffect(() => {
    let gone = false;
    setCoachLoading(true);
    fetch(`/api/coach?date=${date}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((next: CoachResult) => {
        if (!gone) setCoach(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!gone) setCoachLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [date]);

  const exercise = state?.exercises.find((item) => item.id === selected) ?? null;
  const todayLog = state?.today.exercises.find((item) => item.id === selected);
  const last = selected ? state?.lastByExercise[selected] : undefined;
  const goal = coach?.goals.find((item) => item.exerciseId === selected);

  const hit = useMemo(() => {
    if (!todayLog || !goal) return false;
    const weightOk =
      goal.weight == null ||
      todayLog.sets.some((set) => (set.weight ?? 0) >= goal.weight!);
    const qualitySets = todayLog.sets.filter((set) => set.reps >= goal.reps).length;
    return weightOk && (qualitySets >= goal.sets || totalReps(todayLog.sets) >= goal.sets * goal.reps);
  }, [todayLog, goal]);

  async function add(reps: number, weight: number | null) {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, exerciseId: selected, reps, weight }),
      });
      if (!res.ok) throw new Error("could not save set");
      const next = await refresh(date);
      const log = next.today.exercises.find((item) => item.id === selected);
      if (log) {
        setFlash({ exerciseId: selected, index: log.sets.length - 1 });
        window.setTimeout(() => setFlash(null), 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setPending(false);
    }
  }

  async function remove(exerciseId: string, index: number) {
    setError(null);
    const res = await fetch(
      `/api/sets?date=${date}&exerciseId=${exerciseId}&index=${index}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      setError("could not remove set");
      return;
    }
    await refresh(date);
  }

  async function addExercise(name: string) {
    setError(null);
    const res = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setError(body.error ?? "could not add exercise");
      return;
    }
    const created = (await res.json()) as { id: string };
    const next = await refresh(date);
    if (next.exercises.some((item) => item.id === created.id)) setSelected(created.id);
  }

  const defaultWeight =
    lastWeight(todayLog?.sets ?? []) ?? last?.log.sets.at(-1)?.weight ?? goal?.weight ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">workout</p>
          <h1 className="mt-1 text-2xl tracking-tight text-white">{formatLong(date)}</h1>
        </div>
        <div className="flex items-center gap-1 text-neutral-400">
          <button
            type="button"
            onClick={() => setDate(addDays(date, -1))}
            className="h-9 w-9 rounded-md hover:bg-white/5 hover:text-gold"
            aria-label="previous day"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setDate(todayISO())}
            className="h-9 rounded-md px-3 text-[12px] hover:bg-white/5 hover:text-gold"
          >
            today
          </button>
          <label className="relative h-9 w-9 cursor-pointer rounded-md hover:bg-white/5 hover:text-gold">
            <span className="flex h-full items-center justify-center" aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="pick date"
            />
          </label>
          <button
            type="button"
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= todayISO()}
            className="h-9 w-9 rounded-md hover:bg-white/5 hover:text-gold disabled:opacity-30"
            aria-label="next day"
          >
            →
          </button>
        </div>
      </header>

      {state ? (
        <Heatmap
          activity={state.activity}
          selected={date}
          today={todayISO()}
          onSelect={setDate}
        />
      ) : (
        <div className="h-24 animate-pulse rounded-lg bg-neutral-900" />
      )}

      <p
        className={`mb-5 mt-7 text-[15px] leading-6 ${
          coachLoading && !coach ? "animate-pulse text-neutral-600" : "text-neutral-300"
        }`}
      >
        {coach?.headline ?? "Reading the last sessions…"}
        {coach?.source === "rules" ? (
          <span className="ml-2 text-[11px] uppercase tracking-wide text-neutral-600">
            local coach
          </span>
        ) : coach?.source === "luna" ? (
          <span className="ml-2 text-[11px] uppercase tracking-wide text-gold/70">luna</span>
        ) : null}
      </p>

      {coach?.goals.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scroll">
          {coach.goals.map((item) => {
            const meta = state?.exercises.find((exercise) => exercise.id === item.exerciseId);
            const logged = state?.today.exercises.find((log) => log.id === item.exerciseId);
            const done =
              logged && totalReps(logged.sets) >= item.sets * item.reps * 0.8;
            return (
              <button
                key={item.exerciseId}
                type="button"
                onClick={() => setSelected(item.exerciseId)}
                className={`min-w-[168px] shrink-0 rounded-lg px-3 py-2 text-left ring-1 ${
                  selected === item.exerciseId
                    ? "ring-gold"
                    : "ring-white/10 hover:ring-white/25"
                }`}
              >
                <p className="text-[12px] text-neutral-400">{meta?.name ?? item.exerciseId}</p>
                <p className={`font-mono text-[13px] ${done ? "text-gold" : "text-white"}`}>
                  {item.targetLabel}
                  {logged ? (
                    <span className="ml-1 text-neutral-500">
                      {logged.sets.length}/{item.sets}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-neutral-600">{item.lastLabel}</p>
              </button>
            );
          })}
        </div>
      ) : coachLoading ? (
        <div className="mb-6 flex gap-2">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-16 min-w-[168px] animate-pulse rounded-lg bg-neutral-900" />
          ))}
        </div>
      ) : null}

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_200px]">
        {exercise ? (
          <SetForm
            exerciseId={exercise.id}
            exerciseName={exercise.name}
            cue={exercise.cue}
            image={exercise.image}
            goalLabel={goal?.targetLabel ?? null}
            goalWhy={goal?.why ?? (last ? `last: ${last.date}` : null)}
            hit={hit}
            defaultWeight={defaultWeight}
            defaultReps={goal?.reps ?? null}
            pending={pending}
            onSubmit={add}
          />
        ) : (
          <div />
        )}

        <section>
          <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-neutral-500">today</p>
          {state ? (
            <TodayLog
              workout={state.today}
              selected={selected}
              flash={flash}
              onSelect={setSelected}
              onRemove={remove}
            />
          ) : null}
        </section>
      </div>

      <section className="mt-8">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-neutral-500">lifts</p>
        {state ? (
          <ExerciseGrid
            exercises={state.exercises}
            selected={selected}
            onSelect={setSelected}
            onAdd={addExercise}
          />
        ) : null}
      </section>

      <section className="mt-10 pb-16">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-neutral-500">progress</p>
        {exercise && state ? (
          <Progress
            name={exercise.name}
            points={state.progress[exercise.id] ?? []}
          />
        ) : null}
      </section>

      {error ? <p className="fixed bottom-4 right-4 text-[13px] text-red-400">{error}</p> : null}
    </main>
  );
}
