"use client";

import { SERIES_BY_ID } from "@/lib/series";
import { SESSION_TYPE_LABEL } from "@/lib/sources/durations";
import { formatTime } from "@/lib/timezone";
import type { LayoutInfo } from "@/lib/layout";
import type { Session } from "@/types";

const MIN_HEIGHT = 1;

export default function SessionBlock({
  session,
  layout,
  dayStartIso,
  offsetMin,
  selectedEventKey,
  onSelect,
}: {
  session: Session;
  layout: LayoutInfo;
  dayStartIso: string;
  offsetMin: number;
  selectedEventKey: string | null;
  onSelect: (eventKey: string) => void;
}) {
  const series = SERIES_BY_ID[session.series];
  const startMin = Math.max(0, Math.round((Date.parse(session.startUtc) - Date.parse(dayStartIso)) / 60_000));
  const durationMin = Math.max(15, session.durationMin);
  const top = startMin * MIN_HEIGHT;
  const height = durationMin * MIN_HEIGHT;
  const widthPct = 100 / layout.columnCount;
  const leftPct = layout.column * widthPct;

  const startLabel = session.isEstimatedStart ? "TBC" : formatTime(session.startUtc, offsetMin);
  const endLabel = session.isEstimatedEnd ? "?" : formatTime(session.endUtc, offsetMin);

  const isIsolated = selectedEventKey !== null;
  const matches = !isIsolated || selectedEventKey === session.eventKey;
  const isOther = isIsolated && !matches;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(session.eventKey);
      }}
      className="absolute overflow-hidden rounded p-1 text-left text-[10px] leading-tight transition-opacity"
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