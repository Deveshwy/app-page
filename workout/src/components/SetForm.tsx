"use client";

import { useEffect, useRef, useState } from "react";
import { formatNum } from "@/lib/format";

export default function SetForm({
  exerciseId,
  exerciseName,
  cue,
  image,
  goalLabel,
  goalWhy,
  hit,
  defaultWeight,
  defaultReps,
  pending,
  onSubmit,
}: {
  exerciseId: string;
  exerciseName: string;
  cue: string;
  image: string | null;
  goalLabel: string | null;
  goalWhy: string | null;
  hit: boolean;
  defaultWeight: number | null;
  defaultReps: number | null;
  pending: boolean;
  onSubmit: (reps: number, weight: number | null) => void;
}) {
  const repsRef = useRef<HTMLInputElement>(null);
  const [weight, setWeight] = useState(
    defaultWeight != null ? formatNum(defaultWeight) : "",
  );
  const [reps, setReps] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setWeight(defaultWeight != null ? formatNum(defaultWeight) : "");
    setReps("");
    setHint(null);
    requestAnimationFrame(() => repsRef.current?.focus());
    // reset the form when the lift changes, not when last-weight updates after a set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  useEffect(() => {
    setWeight((current) =>
      current === "" && defaultWeight != null ? formatNum(defaultWeight) : current,
    );
  }, [defaultWeight]);

  return (
    <form
      className="rounded-xl bg-neutral-900/80 p-4 ring-1 ring-white/10"
      onSubmit={(event) => {
        event.preventDefault();
        const parsedReps = Number(reps.trim() || defaultReps);
        const rawWeight = weight.trim();
        const parsedWeight =
          rawWeight === ""
            ? defaultWeight
            : Number(rawWeight);
        if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
          setHint("type how many reps, then enter");
          repsRef.current?.focus();
          return;
        }
        setHint(null);
        onSubmit(
          parsedReps,
          Number.isFinite(parsedWeight as number) ? (parsedWeight as number) : null,
        );
        setReps("");
        repsRef.current?.focus();
      }}
    >
      <div className="flex gap-4">
        {image ? (
          <div
            className="relative hidden h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-950 sm:block"
            style={{
              backgroundImage: `url(${image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            aria-hidden
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white">{exerciseName}</p>
              {cue ? <p className="mt-1 text-[12px] text-neutral-500">{cue}</p> : null}
            </div>
            {goalLabel ? (
              <p
                className={`shrink-0 text-right font-mono text-[13px] ${
                  hit ? "text-gold" : "text-neutral-300"
                }`}
              >
                {hit ? "hit " : "goal "}
                {goalLabel}
              </p>
            ) : null}
          </div>
          {goalWhy ? (
            <p className="mb-4 text-[13px] leading-5 text-neutral-400">{goalWhy}</p>
          ) : null}

          <div className="flex items-end gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">
                weight
              </span>
              <span className="flex items-baseline gap-2 border-b border-white/10 focus-within:border-gold">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="—"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  className="w-full bg-transparent pb-1 font-mono text-lg outline-none"
                />
                <span className="pb-1 text-[12px] text-neutral-500">lb</span>
              </span>
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
                inputMode="numeric"
                autoComplete="off"
                placeholder={defaultReps ? String(defaultReps) : "12"}
                value={reps}
                onChange={(event) => setReps(event.target.value)}
                className="w-full border-b border-white/10 bg-transparent pb-1 font-mono text-lg outline-none focus:border-gold"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-gold px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
            >
              {pending ? "…" : "add set"}
            </button>
          </div>
          {hint ? <p className="mt-2 text-[12px] text-gold">{hint}</p> : null}
        </div>
      </div>
    </form>
  );
}
