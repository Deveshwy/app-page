"use client";

import { addDays, formatPretty, parseISO, sundayOf } from "@/lib/dates";
import type { DayActivity } from "@/lib/types";

const LEVEL = ["#171717", "#3d3419", "#6e5a1f", "#b4922c", "#e4c36a"];

function level(reps: number) {
  if (!reps) return 0;
  if (reps < 30) return 1;
  if (reps < 60) return 2;
  if (reps < 100) return 3;
  return 4;
}

export default function Heatmap({
  activity,
  selected,
  today,
  onSelect,
}: {
  activity: DayActivity[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const map = new Map(activity.map((day) => [day.date, day]));
  const start = addDays(sundayOf(today), -52 * 7);
  const weeks = Array.from({ length: 53 }, (_, week) =>
    Array.from({ length: 7 }, (_, dow) => addDays(start, week * 7 + dow)),
  );
  const days = weeks.flat();

  const months: { week: number; label: string }[] = [];
  let lastMonth = "";
  weeks.forEach((week, i) => {
    const month = week[0].slice(0, 7);
    if (month !== lastMonth) {
      months.push({
        week: i,
        label: parseISO(week[0]).toLocaleDateString("en-US", { month: "short" }),
      });
      lastMonth = month;
    }
  });

  const last = [...activity].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const thisMonth = activity.filter((day) => day.date.startsWith(today.slice(0, 7))).length;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-neutral-500">
        <p>
          {thisMonth} session{thisMonth === 1 ? "" : "s"} this month
          {last ? ` · last ${formatPretty(last.date)}` : ""}
        </p>
        <p className="flex items-center gap-1">
          less
          {LEVEL.map((color) => (
            <span
              key={color}
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: color }}
            />
          ))}
          more
        </p>
      </div>

      <div className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-2">
        <div className="mt-4 grid grid-rows-7 gap-[3px] text-[9px] leading-none text-neutral-600">
          <span />
          <span className="self-center">M</span>
          <span />
          <span className="self-center">W</span>
          <span />
          <span className="self-center">F</span>
          <span />
        </div>
        <div>
          <div
            className="relative mb-1 h-4 text-[11px] text-neutral-400"
            style={{ display: "grid", gridTemplateColumns: "repeat(53, minmax(0, 1fr))" }}
          >
            {months.map((month) => (
              <span key={month.week} style={{ gridColumnStart: month.week + 1 }}>
                {month.label}
              </span>
            ))}
          </div>
          <div
            className="grid gap-[3px]"
            style={{
              gridTemplateRows: "repeat(7, minmax(11px, 1fr))",
              gridTemplateColumns: "repeat(53, minmax(0, 1fr))",
              gridAutoFlow: "column",
            }}
          >
            {days.map((date) => {
              const future = date > today;
              const reps = map.get(date)?.reps ?? 0;
              const active = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={future}
                  title={
                    future
                      ? date
                      : `${formatPretty(date)}${reps ? ` · ${reps} reps` : " · rest"}`
                  }
                  onClick={() => onSelect(date)}
                  className={`aspect-square w-full min-h-[11px] rounded-[2px] ${
                    active ? "ring-1 ring-gold" : ""
                  } ${future ? "cursor-default opacity-30" : "hover:ring-1 hover:ring-neutral-400"}`}
                  style={{ background: future ? "#111" : LEVEL[level(reps)] }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
