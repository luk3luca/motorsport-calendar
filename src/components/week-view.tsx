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
  todayIso,
} from "@/lib/timezone";
import SessionBlock from "@/components/session-block";
import TimeAxis from "@/components/time-axis";

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
    // Even when only one day has sessions, keep the classic Fri/Sat/Sun
    // weekend shape: three placeholder columns centered on the day(s) present.
    const baseMs = new Date(`${weekStartIso}T00:00:00Z`).getTime();
    const candidates = [4, 5, 6].map((i) =>
      new Date(baseMs + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    );
    const placeholderDays = candidates.map((iso) => ({
      iso,
      label: formatDateLabel(iso, offsetMin),
      empty: true as const,
    }));
    const placeholderHours = buildHourInfos(
      Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i, false])),
    );
    return (
      <div className="flex flex-col" onClick={onClearSelection}>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
          <div
            className="grid border-b border-[var(--border)] bg-[var(--panel-2)]/60"
            style={{ gridTemplateColumns: "48px repeat(3, minmax(0, 1fr))" }}
          >
            <div className="border-r border-[var(--border)]" />
            {placeholderDays.map((d) => {
              const { wd, dn, mo } = (() => {
                const [wd, dn, mo] = formatDateLabel(d.iso, offsetMin).split(" ");
                return { wd, dn: dn.padStart(2, "0"), mo };
              })();
              return (
                <div key={d.iso} className="flex flex-col items-center gap-1 px-1 py-2 opacity-45">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                    {wd}
                  </span>
                  <span className="font-mono text-lg font-bold leading-none tabular-nums text-[var(--muted)]">
                    {dn}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    {mo}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            className="relative grid"
            style={{ height: 240, gridTemplateColumns: "48px repeat(3, minmax(0, 1fr))" }}
          >
            <div className="border-r border-[var(--border)] bg-[var(--panel-2)]/40">
              <TimeAxis hourInfos={placeholderHours} />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative border-l border-[var(--border)]">
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] opacity-60">
                    No sessions
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const n = days.length;
  const totalPx = hourInfos[23].top + hourInfos[23].height;
  const gridTemplate = `48px repeat(${n}, minmax(0, 1fr))`;
  const today = todayIso(offsetMin);

  const headerParts = (iso: string) => {
    const [wd, dn, mo] = formatDateLabel(iso, offsetMin).split(" ");
    return { wd, dn: dn.padStart(2, "0"), mo };
  };

  return (
    <div className="flex flex-col" onClick={onClearSelection}>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
        <div
          className="grid border-b border-[var(--border)] bg-[var(--panel-2)]/60"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="border-r border-[var(--border)]" />
          {days.map((d, i) => {
            const { wd, dn, mo } = headerParts(d.iso);
            const isToday = d.iso === today;
            // Highlight the month label when it differs from the previous
            // column's month (month boundary inside the week) — otherwise
            // keep it muted but still readable.
            const monthChanged = i > 0 && mo !== headerParts(days[i - 1].iso).mo;
            return (
              <div key={d.iso} className="flex flex-col items-center gap-1 px-1 py-2">
                <span
                  className={`text-[9px] font-bold uppercase tracking-[0.16em] ${
                    isToday ? "text-[var(--accent)]" : "text-[var(--muted)]"
                  }`}
                >
                  {wd}
                </span>
                <span
                  className={`font-mono text-lg font-bold leading-none tabular-nums ${
                    isToday ? "text-[var(--accent)]" : "text-[var(--foreground)]"
                  }`}
                >
                  {dn}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                    isToday || monthChanged
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {mo}
                </span>
              </div>
            );
          })}
        </div>
        <div
          className="relative grid overflow-x-auto"
          style={{ height: totalPx, gridTemplateColumns: gridTemplate }}
        >
          <div className="border-r border-[var(--border)] bg-[var(--panel-2)]/40">
            <TimeAxis hourInfos={hourInfos} />
          </div>
          {days.map((d) => {
            const start = dayStartIso(d.iso, offsetMin);
            const end = dayEndIso(d.iso, offsetMin);
            const daySessions = sessions.filter((s) => s.startUtc < end && s.endUtc > start);
            const layout = computeLayout(daySessions);
            const isToday = d.iso === today;
            return (
              <div
                key={d.iso}
                className={`relative border-l border-[var(--border)] ${
                  isToday ? "bg-[color-mix(in_srgb,var(--accent)_3%,transparent)]" : ""
                }`}
                style={{ minHeight: totalPx }}
              >
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
    </div>
  );
}
