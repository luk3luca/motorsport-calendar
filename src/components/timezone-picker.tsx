"use client";

import { useState } from "react";
import { OFFSET_OPTIONS, getLocalTz } from "@/lib/timezone";

const STORAGE_KEY = "mc:offsetMin";

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
  const [zoneList] = useState(() => OFFSET_OPTIONS);
  const localTzName = typeof window !== "undefined" && localActive ? getLocalTz() : null;
  const btnLabel = localActive
    ? `Local (${localTzName ?? "..."})`
    : "Local";

  return (
    <div className="flex items-center gap-1 text-xs">
      <label className="flex items-center gap-1">
        <span className="opacity-60">TZ</span>
        <select
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            window.localStorage.setItem(STORAGE_KEY, String(v));
            onChange(v);
          }}
          disabled={localActive}
          className="rounded border border-black/15 dark:border-white/20 bg-transparent px-1 py-1 disabled:opacity-40"
        >
          {zoneList.map((z) => (
            <option key={z.offsetMin} value={z.offsetMin} className="text-black dark:text-white">
              {z.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onToggleLocal}
        className={`rounded border px-2 py-1 ${localActive ? "bg-black text-white dark:bg-white dark:text-black" : "border-black/15 dark:border-white/20"}`}
      >
        {btnLabel}
      </button>
    </div>
  );
}