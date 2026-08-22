"use client";

import { formatNum, sharedWeight, totalReps } from "@/lib/format";
import type { Workout } from "@/lib/types";

export default function TodayLog({
  workout,
  selected,
  flash,
  onSelect,
  onRemove,
}: {
  workout: Workout;
  selected: string | null;
  flash: { exerciseId: string; index: number } | null;
  onSelect: (id: string) => void;
  onRemove: (exerciseId: string, index: number) => void;
}) {
  const daily = workout.exercises.reduce(
    (sum, exercise) => sum + totalReps(exercise.sets),
    0,
  );

  if (!workout.exercises.length) {
    return (
      <p className="text-[13px] text-neutral-600">
        nothing yet. pick a lift, type reps, enter.
      </p>
    );
  }

  return (
    <div className="space-y-2 font-mono text-[15px]">
      {workout.exercises.map((exercise) => {
        const mixed = exercise.sets.some(
          (set) => set.weight !== exercise.sets[0].weight,
        );
        const shared = sharedWeight(exercise.sets);
        const total = totalReps(exercise.sets);
        return (
          <div
            key={exercise.id}
            className={`flex items-baseline justify-between gap-4 ${
              selected === exercise.id ? "text-white" : "text-neutral-300"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(exercise.id)}
              className="text-left text-[14px] tracking-tight"
            >
              {exercise.name.toLowerCase()}
            </button>
            <p className="text-right">
              {exercise.sets.map((set, index) => (
                <span key={`${exercise.id}-${index}`}>
                  {index > 0 ? <span className="text-neutral-600"> + </span> : null}
                  <button
                    type="button"
                    title="remove set"
                    onClick={() => onRemove(exercise.id, index)}
                    className={`text-gold hover:line-through ${
                      flash?.exerciseId === exercise.id && flash.index === index
                        ? "underline decoration-gold"
                        : ""
                    }`}
                  >
                    {mixed && set.weight != null
                      ? `${set.reps}@${formatNum(set.weight)}`
                      : set.reps}
                  </button>
                </span>
              ))}
              {exercise.sets.length > 1 ? (
                <span className="text-gold"> = {total}</span>
              ) : null}
              {!mixed && shared != null ? (
                <span className="text-neutral-500"> @ {formatNum(shared)}</span>
              ) : null}
            </p>
          </div>
        );
      })}
      <p className="pt-2 text-right text-xl text-gold">{daily}</p>
    </div>
  );
}
