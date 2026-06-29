"use client";

import { useMemo } from "react";
import type { Session, SeriesId } from "@/types";
import { computeLayout } from "@/lib/layout";
import {
  dayStartIso,
  dayEndIso,
  formatDateLabel,
  computeDayHourHasEvents,
  buildHourInfos,
} from "@/lib/timezone";
import TimeAxis from "@/components/time-axis";
import SessionBlock from "@/components/session-block";

export default function DayView({
  dayIso,
  offsetMin,
  sessions,
  isolatedId,
  onSelectSession,
  onClearSelection,
}: {
  dayIso: string;
  offsetMin: number;
  sessions: Session[];
  isolatedId: string | null;
  onSelectSession: (series: SeriesId, eventKey: string) => void;
  onClearSelection: () => void;
}) {
  const { daySessions, hourInfos } = useMemo(() => {
    const start = dayStartIso(dayIso, offsetMin);
    const end = dayEndIso(dayIso, offsetMin);
    const daySessions = sessions.filter((s) => s.startUtc < end && s.endUtc > start);
    const hourHasEvents = computeDayHourHasEvents(dayIso, offsetMin, sessions);
    const hourInfos = buildHourInfos(hourHasEvents);
    return { daySessions, hourInfos };
  }, [sessions, dayIso, offsetMin]);

  const layout = useMemo(() => computeLayout(daySessions), [daySessions]);
  const startIso = dayStartIso(dayIso, offsetMin);
  const totalPx = hourInfos[23].top + hourInfos[23].height;

  return (
    <div className="flex flex-col">
      <div className="mb-2 text-sm font-semibold">{formatDateLabel(dayIso, offsetMin)}</div>
      <div
        className="relative grid grid-cols-[42px_1fr]"
        style={{ height: totalPx }}
        onClick={onClearSelection}
      >
        <TimeAxis hourInfos={hourInfos} />
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
                  hourInfos={hourInfos}
                  offsetMin={offsetMin}
                  isolatedId={isolatedId}
                  onSelect={onSelectSession}
                />
            );
          })}
        </div>
      </div>
    </div>
  );
}