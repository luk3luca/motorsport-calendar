"use client";

import { useState } from "react";
import { OFFSET_OPTIONS } from "@/lib/timezone";

const STORAGE_KEY = "mc:offsetMin";

export default function TimezonePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (offsetMin: number) => void;
}) {
  const [zoneList] = useState<{ offsetMin: number; label: string }[]>(() =>
    typeof window !== "undefined"
      ? OFFSET_OPTIONS
      : OFFSET_OPTIONS,
  );

  return (
    <label className="text-xs">
      <span className="mr-1 opacity-60">TZ</span>
      <select
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          window.localStorage.setItem(STORAGE_KEY, String(v));
          onChange(v);
        }}
        className="rounded border border-black/15 dark:border-white/20 bg-transparent px-1 py-1"
      >
        {zoneList.map((z) => (
          <option key={z.offsetMin} value={z.offsetMin} className="text-black dark:text-white">
            {z.label}
          </option>
        ))}
      </select>
    </label>
  );
}