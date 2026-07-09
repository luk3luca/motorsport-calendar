"use client";

import { useMemo } from "react";
import type { Session, SeriesId } from "@/types";
import { computeLayout } from "@/lib/layout";
import {
  dayStartIso,
  dayEndIso,
  daysWithSessionsInWeek,
  formatDateLabel,
  computeWeekHourHasEvents,
  buildHourInfos,
} from "@/lib/timezone";
import SessionBlock from "@/components/session-block";

export default function WeekView({
  weekStartIso,
  offsetMin,
  sessions,
  isolatedId,
  onSelectSession,
  onClearSelection,
}: {
  weekStartIso: string;
  offsetMin: number;
  sessions: Session[];
  isolatedId: string | null;
  onSelectSession: (series: SeriesId, eventKey: string) => void;
  onClearSelection: () => void;
}) {
  const { days, hourInfos } = useMemo(() => {
    const present = daysWithSessionsInWeek(weekStartIso, sessions, offsetMin);
    if (present.length === 0) return { days: [], hourInfos: buildHourInfos(Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i, false]))) };
    const baseMs = new Date(`${weekStartIso}T00:00:00Z`).getTime();
    const presentSet = new Set(present);
    const dayList: { iso: string; label: string }[] = [];
    const weekEndMs = baseMs + 7 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 7; i++) {
      const iso = new Date(baseMs + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (presentSet.has(iso)) {
        dayList.push({ iso, label: formatDateLabel(iso, offsetMin) });
      }
    }
    // Include the extra day if a session spills past Sunday midnight
    const spillIso = new Date(weekEndMs).toISOString().slice(0, 10);
    if (presentSet.has(spillIso)) {
      dayList.push({ iso: spillIso, label: formatDateLabel(spillIso, offsetMin) });
    }
    const weekHasEvents = computeWeekHourHasEvents(dayList, offsetMin, sessions);
    return { days: dayList, hourInfos: buildHourInfos(weekHasEvents) };
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
  const totalPx = hourInfos[23].top + hourInfos[23].height;
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
        style={{ height: totalPx, gridTemplateColumns: gridTemplate }}
      >
        <div className="relative">
          {hourInfos.map((info) => (
            <div
              key={info.hour}
              className="absolute left-0 right-0 overflow-hidden"
              style={{ top: info.top, height: info.height }}
            >
              <div className={`border-t border-black/5 dark:border-white/10 ${info.hasEvents ? 'pt-[1px]' : 'flex items-center'}`}>
                <span className="ml-1 inline-block text-[10px] leading-[14px] opacity-50">
                  {`${info.hour.toString().padStart(2, "0")}:00`}
                </span>
              </div>
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
              style={{ minHeight: totalPx }}
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
                    hourInfos={hourInfos}
                    offsetMin={offsetMin}
                    isolatedId={isolatedId}
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