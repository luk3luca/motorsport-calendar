"use client";

import type { CSSProperties } from "react";
import { SERIES_BY_ID } from "@/lib/series";
import { SESSION_TYPE_LABEL, SESSION_TYPE_SHORT } from "@/lib/sources/durations";
import { formatTime, getSessionPosition } from "@/lib/timezone";
import type { HourInfo } from "@/lib/timezone";
import type { LayoutInfo } from "@/lib/layout";
import type { Session, SeriesId } from "@/types";
import type { BlockStyle } from "./block-styles";

/** Deliberate per-series style assignment for the compare mode (accent = mix). */
const SERIES_STYLE_MAP: Record<string, BlockStyle> = {
  f1: "solid", // F1: solid header band, Google-Calendar-like
  f2: "tint",
  f3: "topline",
  f1_academy: "accent",
  motogp: "accent",
  moto2: "tint",
  moto3: "topline",
  formula_e: "accent",
  indycar: "solid",
  wec: "tint",
  nascar: "topline",
  dtm: "accent",
  imsa: "solid",
};

export function styleForSeries(series: string): BlockStyle {
  return SERIES_STYLE_MAP[series] ?? "accent";
}

export default function SessionBlock({
  session,
  layout,
  dayStartIso,
  hourInfos,
  offsetMin,
  isolatedId,
  onSelect,
  blockStyle,
}: {
  session: Session;
  layout: LayoutInfo;
  dayStartIso: string;
  hourInfos: HourInfo[];
  offsetMin: number;
  isolatedId: string | null;
  onSelect: (series: SeriesId, eventKey: string) => void;
  /** Global override; when undefined each series keeps its assigned variant. */
  blockStyle?: BlockStyle;
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
  // End time is estimated (derived from typical duration) for almost every
  // session → show it as "~HH:mm" instead of a bare "?".
  const endLabel = session.isEstimatedEnd
    ? `~${formatTime(session.endUtc, offsetMin)}`
    : formatTime(session.endUtc, offsetMin);

  const isIsolated = isolatedId !== null;
  const isOther = isIsolated && isolatedId !== session.series;

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
      className="session-block absolute overflow-hidden text-left focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
      style={
        {
          top,
          height,
          left: `calc(${leftPct}% + 3px)`,
          width: `calc(${widthPct}% - 6px)`,
          opacity: isOther ? 0.4 : 1,
          filter: isOther ? "grayscale(1)" : "none",
          cursor: "pointer",
          "--sc": series.color,
          "--sc-dark": series.colorDark,
        } as CSSProperties
      }
      title={`${session.name}\n${series.label} ${SESSION_TYPE_LABEL[session.sessionType]}\n${startLabel}-${endLabel}\n${session.venue}`}
    >
      <BlockBody
        style={blockStyle ?? styleForSeries(session.series)}
        session={session}
        seriesLabel={series.shortLabel}
        startLabel={startLabel}
        endLabel={endLabel}
        micro={micro}
        compact={compact}
        isOther={isOther}
        dim={dim}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Variant bodies                                                     */
/* ------------------------------------------------------------------ */

interface BodyProps {
  style: BlockStyle;
  session: Session;
  seriesLabel: string;
  startLabel: string;
  endLabel: string;
  micro: boolean;
  compact: boolean;
  isOther: boolean;
  dim: string;
}

function BlockBody(p: BodyProps) {
  switch (p.style) {
    case "tint":
      return <TintBody {...p} />;
    case "topline":
      return <ToplineBody {...p} />;
    case "solid":
      return <SolidBody {...p} />;
    default:
      return <AccentBody {...p} />;
  }
}

/* --- shared fragments ------------------------------------------------- */

/** Black/white text that contrasts on a series hex color (YIQ luminance). */
function contrastText(hex: string | undefined): string {
  if (!hex || hex.length < 7) return "#fff";
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#141414" : "#ffffff";
}

function TypeBadge({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="shrink-0 rounded-[3px] border px-1 py-px text-[8px] font-bold uppercase leading-[11px] tracking-wider"
      style={{ color: color ?? "inherit", borderColor: "currentColor" }}
    >
      {label}
    </span>
  );
}

function TimeRow({
  start,
  end,
  big,
  alignEnd,
  mutedColor,
}: {
  start: string;
  end: string;
  big?: boolean;
  alignEnd?: boolean;
  mutedColor?: string;
}) {
  if (alignEnd) {
    return (
      <div className="flex items-center gap-1 font-mono tabular-nums">
        <span
          className="shrink-0 font-mono text-[11px] font-bold leading-none tabular-nums"
          style={{ color: "var(--foreground)" }}
        >
          {start}
        </span>
        <span
          className="ml-auto truncate text-[9px] leading-none tabular-nums"
          style={{ color: mutedColor ?? "var(--muted)" }}
        >
          {end}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-1 font-mono tabular-nums">
      <span
        className={`shrink-0 font-bold leading-none ${big ? "text-[13px] md:text-sm" : "text-[11px]"}`}
        style={{ color: "var(--foreground)" }}
      >
        {start}
      </span>
      <span className="shrink-0 text-[9px] leading-none text-[var(--muted)]">→</span>
      <span
        className="min-w-0 truncate text-[10px] leading-none"
        style={{ color: mutedColor ?? "var(--muted)" }}
      >
        {end}
      </span>
    </div>
  );
}

function VenueRow({ venue }: { venue: string }) {
  return (
    <div className="truncate text-[10px] leading-tight text-[var(--muted)]">{venue}</div>
  );
}

/* --- accent (current look) ------------------------------------------- */

function AccentBody(p: BodyProps) {
  return (
    <div
      className="flex h-full flex-col justify-center gap-[2px] rounded-md px-1.5"
      style={{
        background: p.isOther
          ? "color-mix(in srgb, var(--muted) 25%, transparent)"
          : "color-mix(in srgb, var(--sc-text) 13%, transparent)",
        borderLeft: `3px solid ${p.isOther ? "var(--border)" : "var(--sc-text)"}`,
        boxShadow: `inset 0 0 0 1px ${
          p.isOther
            ? "color-mix(in srgb, var(--muted) 25%, transparent)"
            : "color-mix(in srgb, var(--sc-text) 18%, transparent)"
        }`,
      }}
    >
      {!p.micro && (
        <div className="flex items-center gap-1.5 pr-0.5">
          <TypeBadge label={p.seriesLabel} color={p.dim} />
          <span
            className="truncate text-[9px] uppercase leading-[12px] tracking-[0.08em]"
            style={{ color: "var(--muted)" }}
          >
            {SESSION_TYPE_LABEL[p.session.sessionType]}
          </span>
        </div>
      )}
      {!p.micro && (
        <div
          className="truncate text-[11px] font-semibold leading-tight"
          style={{ color: p.isOther ? "var(--muted)" : "var(--sc-text)" }}
        >
          {p.session.name}
        </div>
      )}
      {p.micro ? (
        <TimeRow start={p.startLabel} end="" alignEnd />
      ) : (
        <TimeRow start={p.startLabel} end={p.endLabel} big={!p.compact} />
      )}
      {!p.micro && !p.compact && <VenueRow venue={p.session.venue} />}
      {!p.micro && p.compact && null}
      {p.micro && (
        <div className="flex items-center gap-1">
          <TypeBadge label={p.seriesLabel} color={p.dim} />
          <span
            className="truncate text-[9px] font-bold uppercase leading-[12px] tracking-[0.08em]"
            style={{ color: p.dim }}
          >
            {SESSION_TYPE_SHORT[p.session.sessionType]}
          </span>
          <span
            className="ml-auto shrink-0 font-mono text-[11px] font-bold leading-none tabular-nums"
            style={{ color: p.isOther ? "var(--muted)" : "var(--foreground)" }}
          >
            {p.startLabel}
          </span>
        </div>
      )}
    </div>
  );
}

/* --- tint (full soft fill, no accent bar) ----------------------------- */

function TintBody(p: BodyProps) {
  return (
    <div
      className="flex h-full flex-col justify-center gap-[3px] rounded-lg px-2"
      style={{
        background: p.isOther
          ? "color-mix(in srgb, var(--muted) 18%, transparent)"
          : "color-mix(in srgb, var(--sc) 16%, transparent)",
        borderTop: `2px solid ${p.isOther ? "transparent" : "var(--sc)"}`,
      }}
    >
      {!p.micro && (
        <div className="flex items-center justify-between gap-1.5">
          <span
            className="truncate text-[10px] font-bold uppercase leading-[12px] tracking-[0.08em]"
            style={{ color: p.isOther ? "var(--muted)" : "var(--sc)" }}
          >
            {SESSION_TYPE_SHORT[p.session.sessionType]}
          </span>
          <span
            className="shrink-0 font-mono text-[9px] font-bold uppercase"
            style={{ color: "var(--muted)" }}
          >
            {p.seriesLabel}
          </span>
        </div>
      )}
      <div
        className={`truncate font-semibold leading-tight ${p.micro ? "text-[11px]" : "text-xs"}`}
        style={{ color: "var(--foreground)" }}
      >
        {p.session.name}
      </div>
      <TimeRow start={p.startLabel} end={p.micro ? "" : p.endLabel} alignEnd={p.micro} />
      {!p.micro && !p.compact && <VenueRow venue={p.session.venue} />}
      {p.micro && (
        <span
          className="truncate text-[9px] font-bold uppercase leading-[11px]"
          style={{ color: "var(--muted)" }}
        >
          {p.seriesLabel}
        </span>
      )}
    </div>
  );
}

/* --- topline (flat card, colored top line, dark bg) ------------------- */

function ToplineBody(p: BodyProps) {
  return (
    <div
      className="flex h-full flex-col justify-center gap-[2px] rounded-md px-2"
      style={{
        background: "var(--panel)",
        boxShadow: `inset 0 0 0 1px var(--border), inset 0 3px 0 0 ${p.isOther ? "var(--border)" : "var(--sc)"}`,
      }}
    >
      {!p.micro && (
        <div className="flex items-center gap-1.5">
          <TypeBadge label={p.seriesLabel} color={p.isOther ? "var(--muted)" : "var(--sc)"} />
          <span className="min-w-0 truncate text-[10px] font-semibold leading-tight text-[var(--foreground)]">
            {p.session.name}
          </span>
        </div>
      )}
      {p.micro ? (
        <div className="flex items-center justify-between gap-1">
          <span
            className="shrink-0 truncate text-[9px] font-bold uppercase leading-[12px]"
            style={{ color: p.isOther ? "var(--muted)" : "var(--sc)" }}
          >
            {SESSION_TYPE_SHORT[p.session.sessionType]}
          </span>
          <span
            className="ml-auto shrink-0 font-mono text-[11px] font-bold leading-none tabular-nums"
            style={{ color: "var(--foreground)" }}
          >
            {p.startLabel}
          </span>
        </div>
      ) : (
        <>
          <TimeRow start={p.startLabel} end={p.endLabel} />
          {!p.compact && <VenueRow venue={p.session.venue} />}
        </>
      )}
    </div>
  );
}

/* --- solid (solid header band + light body) ---------------------------- */

function SolidBody(p: BodyProps) {
  const headerInk = contrastText(SERIES_BY_ID[p.session.series]?.color);
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-md"
      style={{
        background: p.isOther
          ? "var(--panel)"
          : "color-mix(in srgb, var(--sc) 7%, var(--panel))",
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${
          p.isOther ? "var(--border)" : "var(--sc-text)"
        } 45%, transparent)`,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-1 px-1.5 py-[2px]"
        style={{
          background: p.isOther ? "var(--muted)" : "var(--sc)",
          color: headerInk,
        }}
      >
        <span className="truncate text-[9px] font-bold uppercase leading-[12px] tracking-wider">
          {SESSION_TYPE_SHORT[p.session.sessionType]}
        </span>
        <span className="shrink-0 font-mono text-[9px] font-bold leading-none">{p.seriesLabel}</span>
      </div>
      {p.micro ? (
        // Micro: badge serie + tipo + orario sulla STESSA riga → niente tagli
        // anche quando l'header solid occupa metà del blocco.
        <div className="flex min-h-0 flex-1 items-center gap-1 px-1.5">
          <span
            className="shrink-0 truncate font-mono text-[11px] font-bold leading-none tabular-nums"
            style={{ color: "var(--foreground)" }}
          >
            {p.startLabel}
          </span>
          <span
            className="min-w-0 truncate text-[9px] font-bold uppercase leading-[12px]"
            style={{ color: "var(--muted)" }}
          >
            {p.seriesLabel}
          </span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-[2px] px-1.5 py-[2px]">
          <div className="truncate text-[11px] font-semibold leading-tight text-[var(--foreground)]">
            {p.session.name}
          </div>
          <TimeRow start={p.startLabel} end={p.endLabel} />
          {!p.compact && <VenueRow venue={p.session.venue} />}
        </div>
      )}
    </div>
  );
}
