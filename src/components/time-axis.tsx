"use client";

import type { HourInfo } from "@/lib/timezone";

export default function TimeAxis({ hourInfos }: { hourInfos: HourInfo[] }) {
  return (
    <div className="relative" style={{ height: hourInfos[23].top + hourInfos[23].height }}>
      {hourInfos.map((info) => (
        <div
          key={info.hour}
          className="absolute left-0 right-0 overflow-hidden"
          style={{ top: info.top, height: info.height }}
        >
          <div className="flex h-full items-center justify-end border-t border-[var(--border)] pr-2">
            <span
              className={`font-mono text-[10px] leading-none tabular-nums ${
                info.hasEvents ? "font-bold text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              {`${info.hour.toString().padStart(2, "0")}:00`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
