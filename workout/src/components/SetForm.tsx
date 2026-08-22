"use client";

import { useEffect, useRef } from "react";
import { formatNum } from "@/lib/format";

export default function SetForm({
  exerciseName,
  cue,
  goalLabel,
  goalWhy,
  hit,
  defaultWeight,
  defaultReps,
  pending,
  onSubmit,
}: {
  exerciseName: string;
  cue: string;
  goalLabel: string | null;
  goalWhy: string | null;
  hit: boolean;
  defaultWeight: number | null;
  defaultReps: number | null;
  pending: boolean;
  onSubmit: (reps: number, weight: number | null) => void;
}) {
  const repsRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (weightRef.current) {
      weightRef.current.value = defaultWeight != null ? formatNum(defaultWeight) : "";
    }
    if (repsRef.current) {
      repsRef.current.value = "";
      repsRef.current.focus();
    }
  }, [exerciseName, defaultWeight]);

  return (
    <form
      className="rounded-xl bg-neutral-900/80 p-4 ring-1 ring-white/10"
      onSubmit={(event) => {
        event.preventDefault();
        const reps = Number(repsRef.current?.value);
        const rawWeight = weightRef.current?.value.trim();
        const weight = rawWeight === "" ? defaultWeight : Number(rawWeight);
        if (!Number.isFinite(reps) || reps <= 0) return;
        onSubmit(reps, Number.isFinite(weight as number) ? (weight as number) : null);
        if (repsRef.current) repsRef.current.value = "";
        repsRef.current?.focus();
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white">{exerciseName}</p>
          {cue ? <p className="mt-1 text-[12px] text-neutral-500">{cue}</p> : null}
        </div>
        {goalLabel ? (
          <p className={`shrink-0 text-right font-mono text-[13px] ${hit ? "text-gold" : "text-neutral-300"}`}>
            {hit ? "hit " : "goal "}
            {goalLabel}
          </p>
        ) : null}
      </div>
      {goalWhy ? <p className="mb-4 text-[13px] leading-5 text-neutral-400">{goalWhy}</p> : null}

      <div className="flex items-end gap-3">
        <label className="flex-1">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">
            weight
          </span>
          <input
            ref={weightRef}
            type="number"
            step="0.5"
            min="0"
            placeholder="lb"
            className="w-full border-b border-white/10 bg-transparent pb-1 font-mono text-lg outline-none focus:border-gold"
          />
        </label>
        <label className="flex-[1.3]">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">
            reps
          </span>
          <input
            ref={repsRef}
            type="number"
            min="1"
            step="1"
            placeholder={defaultReps ? String(defaultReps) : "0"}
            className="w-full border-b border-white/10 bg-transparent pb-1 font-mono text-lg outline-none focus:border-gold"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gold px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
        >
          add set
        </button>
      </div>
    </form>
  );
}
