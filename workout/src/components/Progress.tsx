"use client";

import { formatPretty, todayISO } from "@/lib/dates";
import { formatNum } from "@/lib/format";
import type { ProgressPoint } from "@/lib/types";

export default function Progress({
  name,
  points,
}: {
  name: string;
  points: ProgressPoint[];
}) {
  if (points.length < 1) {
    return (
      <p className="text-[13px] text-neutral-600">
        no history for {name.toLowerCase()} yet.
      </p>
    );
  }

  const width = 640;
  const height = 88;
  const pad = 8;
  const values = points.map((point) => point.reps);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const today = todayISO();
  const lastIsToday = points[points.length - 1].date === today;
  const finished = lastIsToday ? points.slice(0, -1) : points;
  const shown = finished.at(-1) ?? points[points.length - 1];
  const prior = finished.length > 1 ? finished[finished.length - 2] : undefined;
  const delta = prior ? shown.reps - prior.reps : 0;

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((point.reps - min) / span) * (height - pad * 2);
    return { x, y, point, live: lastIsToday && index === points.length - 1 };
  });

  const path = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x} ${coord.y}`)
    .join(" ");

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-neutral-500">
          {name.toLowerCase()} · {finished.length || points.length} session
          {(finished.length || points.length) === 1 ? "" : "s"}
        </p>
        <p className="font-mono text-[13px] text-neutral-300">
          {shown.reps} reps
          {shown.weight != null ? ` @ ${formatNum(shown.weight)}lb` : ""}
          {lastIsToday ? (
            <span className="text-neutral-600">
              {" "}
              · {points[points.length - 1].reps} so far today
            </span>
          ) : delta !== 0 ? (
            <span className={delta > 0 ? "text-gold" : "text-neutral-500"}>
              {" "}
              {delta > 0 ? "↑" : "↓"}
              {Math.abs(delta)} vs last
            </span>
          ) : null}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full">
        <path d={path} fill="none" stroke="#e4c36a" strokeWidth="2" />
        {coords.map((coord) => (
          <circle
            key={coord.point.date}
            cx={coord.x}
            cy={coord.y}
            r="3.5"
            fill={coord.live ? "#737373" : "#e4c36a"}
          >
            <title>
              {formatPretty(coord.point.date)} · {coord.point.reps} reps
              {coord.point.weight != null
                ? ` @ ${formatNum(coord.point.weight)}lb`
                : ""}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-neutral-600">
        <span>{formatPretty(points[0].date)}</span>
        <span>best {max}</span>
        <span>{formatPretty(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
