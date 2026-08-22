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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {exercises.map((exercise) => {
        const active = exercise.id === selected;
        return (
          <button
            key={exercise.id}
            type="button"
            onClick={() => onSelect(exercise.id)}
            className={`group text-left ${active ? "" : "opacity-80 hover:opacity-100"}`}
          >
            <div
              className={`relative aspect-square overflow-hidden rounded-lg bg-neutral-900 ${
                active ? "ring-2 ring-gold" : "ring-1 ring-white/10"
              }`}
            >
              {exercise.image ? (
                <Image
                  src={exercise.image}
                  alt={exercise.name}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-2xl text-neutral-500">
                  {exercise.name[0]}
                </span>
              )}
            </div>
            <p className={`mt-1.5 truncate text-[12px] ${active ? "text-gold" : "text-neutral-400"}`}>
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
      className="text-left"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.elements.namedItem("name") as HTMLInputElement;
        const name = input.value.trim();
        if (!name) return;
        onAdd(name);
        input.value = "";
      }}
    >
      <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg ring-1 ring-dashed ring-white/15">
        <input
          name="name"
          placeholder="new lift"
          className="w-[80%] bg-transparent text-center text-[12px] text-neutral-300 outline-none placeholder:text-neutral-600"
        />
        <button type="submit" className="text-[11px] text-neutral-500 hover:text-gold">
          add
        </button>
      </div>
    </form>
  );
}
