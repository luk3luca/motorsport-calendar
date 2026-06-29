"use client";

import { useMemo } from "react";
import type { Session } from "@/types";
import { computeLayout } from "@/lib/layout";
import {
  dayStartIso,
  dayEndIso,
  daysWithSessionsInWeek,
  formatDateLabel,
} from "@/lib/timezone";
import SessionBlock from "@/components/session-block";

const HOUR_HEIGHT = 60;
const DAY_HEIGHT = 24 * HOUR_HEIGHT;
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => i);

export default function WeekView({
  weekStartIso,
  offsetMin,
  sessions,
  selectedEventKey,
  onSelectSession,
  onClearSelection,
}: {
  weekStartIso: string;
  offsetMin: number;
  sessions: Session[];
  selectedEventKey: string | null;
  onSelectSession: (eventKey: string) => void;
  onClearSelection: () => void;
}) {
  const days = useMemo(() => {
    const present = daysWithSessionsInWeek(weekStartIso, sessions, offsetMin);
    if (present.length === 0) return [];
    const base = new Date(`${weekStartIso}T00:00:00Z`).getTime();
    const presentSet = new Set(present);
    const out: { iso: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base + i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().slice(0, 10);
      if (presentSet.has(iso)) {
        out.push({
          iso,
          label: formatDateLabel(iso, offsetMin),
        });
      }
    }
    return out;
  }, [weekStartIso, sessions, offsetMin]);

  if (days.length === 0) {
    return (
      <div
        className="rounded border border-dashed border-black/20 p-6 text-center text-sm opacity-60 dark:border-white/20"
        onClick={onClearSelection}
      >
        No sessions this week.
      </div>
    );
  }

  const n = days.length;
  const gridTemplate = `42px repeat(${n}, minmax(0, 1fr))`;

  return (
    <div className="flex flex-col" onClick={onClearSelection}>
      <div
        className="grid border-b border-black/10 dark:border-white/10"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div />
        {days.map((d) => (
          <div key={d.iso} className="px-1 py-1 text-center text-xs">
            {d.label}
          </div>
        ))}
      </div>
      <div
        className="relative grid overflow-x-auto"
        style={{ height: DAY_HEIGHT, gridTemplateColumns: gridTemplate }}
      >
        <div className="relative">
          {HOUR_LABELS.map((h) => (
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
        {days.map((d) => {
          const start = dayStartIso(d.iso, offsetMin);
          const end = dayEndIso(d.iso, offsetMin);
          const daySessions = sessions.filter((s) => s.startUtc < end && s.endUtc > start);
          const layout = computeLayout(daySessions);
          return (
            <div
              key={d.iso}
              className="relative border-l border-black/10 dark:border-white/10"
              style={{ minHeight: DAY_HEIGHT }}
            >
              {daySessions.map((s) => {
                const li = layout.get(s.id);
                if (!li) return null;
                return (
                  <SessionBlock
                    key={s.id}
                    session={s}
                    layout={li}
                    dayStartIso={start}
                    offsetMin={offsetMin}
                    selectedEventKey={selectedEventKey}
                    onSelect={onSelectSession}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}