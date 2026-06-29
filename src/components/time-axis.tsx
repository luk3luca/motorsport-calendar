"use client";

const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function TimeAxis() {
  return (
    <div className="relative" style={{ height: 24 * HOUR_HEIGHT }}>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-black/5 dark:border-white/10"
          style={{ top: h * HOUR_HEIGHT }}
        >
          <span className="ml-1 -mt-2 inline-block text-[10px] opacity-50">
            {`${h.toString().padStart(2, "0")}:00`}
          </span>
        </div>
      ))}
    </div>
  );
}