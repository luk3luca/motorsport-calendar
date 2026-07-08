"use client";

import {
  nextDayIso,
  previousDayIso,
  todayIso,
  nextWeekStartIso,
  previousWeekStartIso,
} from "@/lib/timezone";

export default function DateNav({
  view,
  cursor,
  offsetMin,
  onChange,
}: {
  view: "day" | "week";
  cursor: string;
  offsetMin: number;
  onChange: (next: string) => void;
}) {
  const prev = view === "day" ? previousDayIso(cursor) : previousWeekStartIso(cursor);
  const next = view === "day" ? nextDayIso(cursor) : nextWeekStartIso(cursor);
  const today = todayIso(offsetMin);
  const isToday = cursor === today;
  return (
    <div className="flex flex-nowrap items-center gap-2 text-xs">
      <button
        type="button"
        onClick={() => onChange(prev)}
        className="rounded border border-black/15 dark:border-white/20 px-2 py-1"
      >
        Prev
      </button>
      <button
        type="button"
        onClick={() => onChange(today)}
        disabled={isToday}
        className="rounded border border-black/15 dark:border-white/20 px-2 py-1 disabled:opacity-40"
      >
        Today
      </button>
      <button
        type="button"
        onClick={() => onChange(next)}
        className="rounded border border-black/15 dark:border-white/20 px-2 py-1"
      >
        Next
      </button>
      <span className="ml-1 font-mono opacity-70">{cursor}</span>
    </div>
  );
}