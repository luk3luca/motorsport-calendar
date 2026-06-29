"use client";

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
    session.durationMin,
    dayStartIso,
    hourInfos,
  );
  const widthPct = 100 / layout.columnCount;
  const leftPct = layout.column * widthPct;

  const startLabel = session.isEstimatedStart ? "TBC" : formatTime(session.startUtc, offsetMin);
  const endLabel = session.isEstimatedEnd ? "?" : formatTime(session.endUtc, offsetMin);

  const isIsolated = isolatedId !== null;
  const matches = isIsolated && isolatedId === session.series + ":" + session.eventKey;
  const isOther = isIsolated && !matches;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(session.series, session.eventKey);
      }}
      className="absolute overflow-hidden rounded p-1 text-center text-xs leading-tight transition-opacity"
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        background: isOther ? "rgba(120,120,120,0.18)" : series.color + "33",
        borderLeft: `3px solid ${isOther ? "#888" : series.color}`,
        opacity: isOther ? 0.45 : 1,
        filter: isOther ? "grayscale(1)" : "none",
        cursor: "pointer",
      }}
      title={`${session.name}\n${series.label} ${SESSION_TYPE_LABEL[session.sessionType]}\n${startLabel}-${endLabel}\n${session.venue}`}
    >
      <span
        className="mb-px block rounded px-1 text-[10px] font-bold leading-[14px] uppercase"
        style={{ background: isOther ? "#888" : series.color, color: "#fff" }}
      >
        {series.shortLabel}
      </span>
      <div
        className="font-semibold truncate"
        style={{ color: isOther ? "#888" : series.color }}
      >
        {session.name}
      </div>
      <div className="opacity-70 truncate">
        {startLabel}-{endLabel}
      </div>
      <div className="opacity-70 truncate">
        {session.countryFlagEmoji} {session.venue}
      </div>
    </button>
  );
}