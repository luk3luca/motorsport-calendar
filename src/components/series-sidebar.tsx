"use client";

import type { CSSProperties } from "react";
import { SERIES } from "@/lib/series";
import type { SeriesId } from "@/types";

export const STORAGE_KEY = "mc:selectedSeries";

export function loadInitial(): SeriesId[] {
  if (typeof window === "undefined") return SERIES.filter((s) => s.defaultOn).map((s) => s.id);
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as SeriesId[];
      if (Array.isArray(parsed)) return parsed.filter((id) => SERIES.some((s) => s.id === id));
    } catch {
      // corrupted storage -> fall back to defaults
    }
  }
  return SERIES.filter((s) => s.defaultOn).map((s) => s.id);
}

interface SeriesGroup {
  name: string;
  ids: SeriesId[];
}

const GROUPS: SeriesGroup[] = [
  { name: "Formula", ids: ["f1", "f2", "f3", "f1_academy"] },
  { name: "MotoGP", ids: ["motogp", "moto2", "moto3"] },
  { name: "Open Wheel", ids: ["formula_e", "indycar"] },
  { name: "GT & Touring", ids: ["wec", "imsa", "dtm", "sbk"] },
  { name: "Rally & Stock", ids: ["wrc", "nascar"] },
];

export default function SeriesSidebar({
  selected,
  onChange,
  counts,
  onClose,
}: {
  selected: SeriesId[];
  onChange: (next: SeriesId[]) => void;
  counts: Record<SeriesId, number>;
  onClose?: () => void;
}) {
  const allIds = SERIES.map((s) => s.id);
  const selectAll = () => onChange(allIds);
  const selectNone = () => onChange([]);
  const toggle = (id: SeriesId) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3 py-3">
        <span className="checker-strip h-4 w-4 shrink-0 rounded-[4px]" aria-hidden />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold leading-tight tracking-tight">
            Motorsport Calendar
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Series filters
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close series menu"
            className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--border)] text-sm leading-none text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-2 pb-1 pt-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          Series
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={selectAll}
            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            All
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            None
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {GROUPS.map((group) => (
          <div key={group.name} className="mt-3 first:mt-1">
            <div className="mb-1 flex items-center gap-2 px-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {group.name}
              </span>
              <span className="h-px flex-1 bg-[var(--border)]" aria-hidden />
            </div>
            {group.ids.map((id) => {
              const s = SERIES.find((x) => x.id === id);
              if (!s) return null;
              const checked = selected.includes(id);
              const count = counts[id] ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  aria-pressed={checked}
                  title={`${s.label} — ${count} session${count === 1 ? "" : "s"} in view`}
                  className={`series-row group flex w-full items-center gap-2.5 rounded-md border-l-2 py-[7px] pl-2 pr-1.5 text-left transition-opacity ${
                    checked ? "" : "opacity-55 hover:opacity-85"
                  }`}
                  style={
                    {
                      borderLeftColor: checked ? "var(--sc-text)" : "transparent",
                      background: checked
                        ? `color-mix(in srgb, ${s.color} 9%, transparent)`
                        : "transparent",
                      "--sc": s.color,
                      "--sc-dark": s.colorDark,
                    } as CSSProperties
                  }
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-[3px]"
                    style={{ background: "var(--sc-text)" }}
                    aria-hidden
                  />
                  <span
                    className={`w-8 shrink-0 font-mono text-[11px] font-bold tracking-wide ${
                      checked ? "" : "text-[var(--muted)]"
                    }`}
                    style={checked ? { color: "var(--sc-text)" } : undefined}
                  >
                    {s.shortLabel}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-xs font-medium ${
                      checked ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-px font-mono text-[10px] leading-[14px] tabular-nums ${
                      count > 0
                        ? "bg-[var(--track)] font-bold text-[var(--accent)]"
                        : "bg-[var(--track)] text-[var(--muted)]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border)] px-3 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          <span className="font-bold text-[var(--accent)]">{selected.length}</span> / {SERIES.length}{" "}
          active
        </span>
      </div>
    </div>
  );
}
