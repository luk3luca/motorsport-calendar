"use client";

import type { CSSProperties } from "react";
import { SERIES_BY_ID } from "@/lib/series";
import { SESSION_TYPE_LABEL } from "@/lib/sources/durations";
import { formatTime, getSessionPosition } from "@/lib/timezone";
import type { HourInfo } from "@/lib/timezone";
import type { LayoutInfo } from "@/lib/layout";
import type { Session, SeriesId } from "@/types";

export default function SessionBlock({
  session,
  layout,
  dayStartIso,
  hourInfos,
  offsetMin,
  isolatedId,
  onSelect,
}: {
  session: Session;
  layout: LayoutInfo;
  dayStartIso: string;
  hourInfos: HourInfo[];
  offsetMin: number;
  isolatedId: string | null;
  onSelect: (series: SeriesId, eventKey: string) => void;
}) {
  const series = SERIES_BY_ID[session.series];
  const { top, height } = getSessionPosition(
    session.startUtc,
    session.endUtc,
    dayStartIso,
    hourInfos,
  );
  const widthPct = 100 / layout.columnCount;
  const leftPct = layout.column * widthPct;

  const startLabel = session.isEstimatedStart ? "TBC" : formatTime(session.startUtc, offsetMin);
  const endLabel = session.isEstimatedEnd ? "?" : formatTime(session.endUtc, offsetMin);

  const isIsolated = isolatedId !== null;
  const isOther = isIsolated && isolatedId !== session.series;

  // Adapt content density to the available height (20px empty-hour slots vs 90px busy hours).
  // Thresholds sized so content never clips: badge+name+time ≈ 47-49.5px, all rows ≈ 62px.
  // micro: time row only; compact: badge + name + time (venue hidden); full: all rows.
  const micro = height < 50;
  const compact = height < 68;

  const dim = isOther ? "var(--muted)" : "var(--sc-text)";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(session.series, session.eventKey);
      }}
      className="session-block absolute overflow-hidden rounded-md px-1.5 text-left focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
      style={
        {
          top,
          height,
          left: `calc(${leftPct}% + 3px)`,
          width: `calc(${widthPct}% - 6px)`,
          background: isOther
            ? "color-mix(in srgb, var(--muted) 25%, transparent)"
            : `color-mix(in srgb, var(--sc-text) 13%, transparent)`,
          borderLeft: `3px solid ${isOther ? "var(--border)" : "var(--sc-text)"}`,
          opacity: isOther ? 0.4 : 1,
          filter: isOther ? "grayscale(1)" : "none",
          cursor: "pointer",
          boxShadow: `inset 0 0 0 1px ${
            isOther
              ? "color-mix(in srgb, var(--muted) 25%, transparent)"
              : "color-mix(in srgb, var(--sc-text) 18%, transparent)"
          }`,
          "--sc": series.color,
          "--sc-dark": series.colorDark,
        } as CSSProperties
      }
      title={`${session.name}\n${series.label} ${SESSION_TYPE_LABEL[session.sessionType]}\n${startLabel}-${endLabel}\n${session.venue}`}
    >
      <div className="flex h-full flex-col justify-center gap-[2px]">
        {!micro && (
          <div className="flex items-center gap-1.5 pr-0.5">
            <span
              className="shrink-0 rounded-[3px] border px-1 py-px text-[9px] font-bold uppercase leading-[12px] tracking-wider"
              style={{
                color: dim,
                borderColor: isOther
                  ? "var(--border)"
                  : "color-mix(in srgb, var(--sc-text) 45%, transparent)",
              }}
            >
              {series.shortLabel}
            </span>
            <span
              className="truncate text-[9px] uppercase leading-[12px] tracking-[0.08em]"
              style={{ color: "var(--muted)" }}
            >
              {SESSION_TYPE_LABEL[session.sessionType]}
            </span>
          </div>
        )}
        {!micro && (
          <div
            className="truncate text-[11px] font-semibold leading-tight"
            style={{ color: isOther ? "var(--muted)" : "var(--sc-text)" }}
          >
            {session.name}
          </div>
        )}
        <div className="flex items-baseline gap-1 font-mono tabular-nums">
          <span
            className={`shrink-0 font-bold leading-none ${
              micro ? "text-[11px]" : "text-[13px] md:text-sm"
            }`}
            style={{ color: isOther ? "var(--muted)" : "var(--foreground)" }}
          >
            {startLabel}
          </span>
          <span
            className="shrink-0 text-[9px] leading-none"
            style={{ color: "var(--muted)" }}
          >
            →
          </span>
          <span
            className="min-w-0 truncate text-[10px] leading-none"
            style={{ color: "var(--muted)" }}
          >
            {endLabel}
          </span>
        </div>
        {!compact && (
          <div
            className="truncate text-[10px] leading-tight"
            style={{ color: "var(--muted)" }}
          >
            {session.countryFlagEmoji} {session.venue}
          </div>
        )}
      </div>
    </button>
  );
}
