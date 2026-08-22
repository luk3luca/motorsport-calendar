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
  tzKey,
  sessions,
  isolatedId,
  blockStyle,
  onSelectSession,
  onClearSelection,
}: {
  dayIso: string;
  offsetMin: number;
  /** Changes whenever the active timezone mode changes (offset ⇄ local). */
  tzKey?: string;
  sessions: Session[];
  isolatedId: string | null;
  blockStyle?: import("@/components/block-styles").BlockStyle;
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
    // tzKey: the module-level _localTz is invisible to React — recompute when
    // the timezone MODE changes even if offsetMin stays the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, dayIso, offsetMin, tzKey]);

  const layout = useMemo(() => computeLayout(daySessions), [daySessions]);
  const startIso = dayStartIso(dayIso, offsetMin);
  const totalPx = hourInfos[23].top + hourInfos[23].height;

  if (daySessions.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center"
        onClick={onClearSelection}
      >
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          No sessions on this day
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Move to another date or enable more series in the sidebar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-base font-bold tracking-tight tabular-nums">
          {formatDateLabel(dayIso, offsetMin)}
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          {daySessions.length} session{daySessions.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
        <div
          className="relative grid grid-cols-[48px_1fr]"
          style={{ height: totalPx }}
          onClick={onClearSelection}
        >
          <div className="border-r border-[var(--border)] bg-[var(--panel-2)]/40">
            <TimeAxis hourInfos={hourInfos} />
          </div>
          <div className="relative">
            {hourInfos.map((info) => (
              <div
                key={info.hour}
                className="pointer-events-none absolute inset-x-0 h-px bg-[var(--border)]/60"
                style={{ top: info.top }}
              />
            ))}
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
                  blockStyle={blockStyle}
                  onSelect={onSelectSession}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
