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
          <div className="border-t border-black/5 dark:border-white/10 pt-[1px]">
            <span className="ml-1 inline-block text-[10px] leading-[14px] opacity-50">
              {`${info.hour.toString().padStart(2, "0")}:00`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}