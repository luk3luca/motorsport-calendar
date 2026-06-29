"use client";

import { useEffect, useRef, useState } from "react";
import { SERIES } from "@/lib/series";
import type { SeriesId } from "@/types";

const STORAGE_KEY = "mc:selectedSeries";

function loadInitial(): SeriesId[] {
  if (typeof window === "undefined") return SERIES.filter((s) => s.defaultOn).map((s) => s.id);
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as SeriesId[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
    }
  }
  return SERIES.filter((s) => s.defaultOn).map((s) => s.id);
}

export default function SeriesToggle({
  selected,
  onChange,
}: {
  selected: SeriesId[];
  onChange: (next: SeriesId[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const allIds = SERIES.map((s) => s.id);
  const selectAll = () => onChange(allIds);
  const selectNone = () => onChange([]);
  const toggle = (id: SeriesId) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-black/15 dark:border-white/20 px-2 py-1 text-xs"
      >
        Series ({selected.length})
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 rounded border border-black/15 dark:border-white/20 bg-white dark:bg-neutral-900 shadow-lg">
          <div className="flex justify-between gap-2 border-b border-black/10 dark:border-white/10 px-2 py-1">
            <button onClick={selectAll} className="text-xs underline">All</button>
            <button onClick={selectNone} className="text-xs underline">None</button>
          </div>
          <ul className="max-h-80 overflow-auto">
            {SERIES.map((s) => {
              const checked = selected.includes(s.id);
              return (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.id)}
                    />
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: s.color }}
                      aria-hidden
                    />
                    <span>{s.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export { loadInitial, STORAGE_KEY };