"use client";

import { useMemo } from "react";
import type { Session } from "@/types";
import { computeLayout } from "@/lib/layout";
import { dayStartIso, dayEndIso, formatDateLabel } from "@/lib/timezone";
import TimeAxis from "@/components/time-axis";
import SessionBlock from "@/components/session-block";

const DAY_HEIGHT = 24 * 60;

export default function DayView({
  dayIso,
  offsetMin,
  sessions,
  selectedEventKey,
  onSelectSession,
  onClearSelection,
}: {
  dayIso: string;
  offsetMin: number;
  sessions: Session[];
  selectedEventKey: string | null;
  onSelectSession: (eventKey: string) => void;
  onClearSelection: () => void;
}) {
  const { daySessions, layout } = useMemo(() => {
    const start = dayStartIso(dayIso, offsetMin);
    const end = dayEndIso(dayIso, offsetMin);
    const daySessions = sessions.filter((s) => s.startUtc < end && s.endUtc > start);
    const layout = computeLayout(daySessions);
    return { daySessions, layout };
  }, [sessions, dayIso, offsetMin]);

  const startIso = dayStartIso(dayIso, offsetMin);

  return (
    <div className="flex flex-col">
      <div className="mb-2 text-sm font-semibold">{formatDateLabel(dayIso, offsetMin)}</div>
      <div
        className="relative grid grid-cols-[42px_1fr]"
        style={{ height: DAY_HEIGHT }}
        onClick={onClearSelection}
      >
        <TimeAxis />
        <div className="relative border-l border-black/10 dark:border-white/10">
          {daySessions.map((s) => {
            const li = layout.get(s.id);
            if (!li) return null;
            return (
              <SessionBlock
                key={s.id}
                session={s}
                layout={li}
                dayStartIso={startIso}
                offsetMin={offsetMin}
                selectedEventKey={selectedEventKey}
                onSelect={onSelectSession}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}