"use client";

import { OFFSET_OPTIONS, getLocalTz } from "@/lib/timezone";

export const TZ_STORAGE_KEY = "mc:offsetMin";

export default function TimezonePicker({
  value,
  onChange,
  localActive,
  onToggleLocal,
}: {
  value: number;
  onChange: (offsetMin: number) => void;
  localActive: boolean;
  onToggleLocal: () => void;
}) {
  const zoneList = OFFSET_OPTIONS;
  const localTzName = typeof window !== "undefined" && localActive ? getLocalTz() : null;
  const btnLabel = localActive ? `Local · ${localTzName ?? "..."}` : "Local";

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <label className="flex items-center gap-1.5">
        <span className="rounded-[4px] border border-[var(--border)] px-1 py-[3px] font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
          TZ
        </span>
        <select
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            window.localStorage.setItem(TZ_STORAGE_KEY, String(v));
            onChange(v);
          }}
          disabled={localActive}
          className="h-7 min-w-[150px] rounded-md border border-[var(--border)] bg-[var(--panel)] px-1.5 font-mono text-[11px] tabular-nums text-[var(--foreground)] disabled:opacity-40"
        >
          {zoneList.map((z) => (
            <option key={z.offsetMin} value={z.offsetMin}>
              {z.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onToggleLocal}
        title="Show times in your local timezone"
        className={`h-7 rounded-md border px-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
          localActive
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
            : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        }`}
      >
        {btnLabel}
      </button>
    </div>
  );
}
