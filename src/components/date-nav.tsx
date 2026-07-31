"use client";

import {
  nextDayIso,
  previousDayIso,
  todayIso,
  nextWeekStartIso,
  previousWeekStartIso,
  weekStartIso,
  formatDateLabel,
  formatDateShort,
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

  const weekStart = weekStartIso(cursor);
  const weekEnd = new Date(
    Date.parse(`${weekStart}T00:00:00Z`) + 6 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const label =
    view === "day"
      ? formatDateLabel(cursor, offsetMin)
      : `${formatDateShort(weekStart, offsetMin)} – ${formatDateShort(weekEnd, offsetMin)}`;

  const arrow =
    "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--panel)] font-mono text-sm leading-none text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]";

  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      <button type="button" aria-label="Previous" onClick={() => onChange(prev)} className={arrow}>
        ‹
      </button>
      <button
        type="button"
        onClick={() => onChange(today)}
        disabled={isToday}
        className="h-7 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-default disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted)]"
      >
        Today
      </button>
      <button type="button" aria-label="Next" onClick={() => onChange(next)} className={arrow}>
        ›
      </button>
      <span
        title={cursor}
        className="ml-1 hidden whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1 font-mono text-[11px] font-semibold tracking-tight tabular-nums text-[var(--foreground)] sm:inline-block"
      >
        {label}
      </span>
    </div>
  );
}
