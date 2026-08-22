"use client";

import Image from "next/image";
import type { Exercise } from "@/lib/types";

export default function ExerciseGrid({
  exercises,
  selected,
  onSelect,
  onAdd,
}: {
  exercises: Exercise[];
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {exercises.map((exercise, index) => {
        const active = exercise.id === selected;
        return (
          <button
            key={exercise.id}
            type="button"
            onClick={() => onSelect(exercise.id)}
            className="w-[88px] shrink-0 text-left"
          >
            <div
              className={`relative aspect-square overflow-hidden rounded-lg bg-neutral-900 ${
                active ? "ring-2 ring-gold" : "ring-1 ring-white/10 hover:ring-white/30"
              }`}
            >
              {exercise.image ? (
                <Image
                  src={exercise.image}
                  alt={exercise.name}
                  fill
                  sizes="88px"
                  priority={index < 6}
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-xl text-neutral-500">
                  {exercise.name[0]}
                </span>
              )}
            </div>
            <p
              className={`mt-1 truncate text-[11px] ${
                active ? "text-gold" : "text-neutral-400"
              }`}
            >
              {exercise.name}
            </p>
          </button>
        );
      })}
      <AddTile onAdd={onAdd} />
    </div>
  );
}

function AddTile({ onAdd }: { onAdd: (name: string) => void }) {
  return (
    <form
      className="w-[88px] shrink-0"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.elements.namedItem("name") as HTMLInputElement;
        const name = input.value.trim();
        if (!name) {
          input.focus();
          return;
        }
        onAdd(name);
        input.value = "";
      }}
    >
      <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg ring-1 ring-dashed ring-white/20 hover:ring-gold/50">
        <span className="text-lg leading-none text-neutral-500">+</span>
        <input
          name="name"
          placeholder="new"
          autoComplete="off"
          className="w-[72%] bg-transparent text-center text-[11px] text-neutral-300 outline-none placeholder:text-neutral-600"
        />
      </div>
    </form>
  );
}
