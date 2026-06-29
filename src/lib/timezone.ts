import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export const DEFAULT_OFFSET_MIN = 60;

export interface OffsetOption {
  offsetMin: number;
  label: string;
}

const OFFSET_CITY_HINT: Record<number, string> = {
  "-720": "Baker Island",
  "-660": "Pago Pago",
  "-600": "Honolulu",
  "-540": "Anchorage",
  "-480": "Los Angeles",
  "-420": "Denver",
  "-360": "Mexico City",
  "-300": "New York",
  "-240": "Santiago",
  "-180": "Sao Paulo / Buenos Aires",
  "-120": "Mid-Atlantic",
  "-60": "Cape Verde",
  "0": "London",
  "60": "Rome",
  "120": "Athens",
  "180": "Moscow / Istanbul",
  "210": "Tehran",
  "240": "Dubai",
  "300": "Karachi",
  "330": "Mumbai",
  "345": "Kathmandu",
  "360": "Dhaka",
  "390": "Yangon",
  "420": "Bangkok",
  "480": "Shanghai",
  "510": "Pyongyang",
  "540": "Tokyo",
  "570": "Adelaide",
  "600": "Sydney",
  "630": "Lord Howe",
  "660": "Auckland",
  "720": "Fiji",
  "780": "Tonga",
  "840": "Kiribati",
};

function formatOffset(off: number): string {
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${m.toString().padStart(2, "0")}`;
}

export const OFFSET_OPTIONS: OffsetOption[] = (() => {
  const step = 60;
  const out: OffsetOption[] = [];
  for (let off = -12 * 60; off <= 14 * 60; off += step) {
    const utcLabel = formatOffset(off);
    const city = OFFSET_CITY_HINT[off] ?? "";
    out.push({ offsetMin: off, label: city ? `${utcLabel} (${city})` : utcLabel });
  }
  return out;
})();

export function formatTime(iso: string, offsetMin: number): string {
  return dayjs.utc(iso).utcOffset(offsetMin).format("HH:mm");
}

export function formatDateLabel(dateIso: string, offsetMin: number): string {
  return dayjs.utc(`${dateIso}T12:00:00Z`).utcOffset(offsetMin).format("ddd D MMM");
}

export function formatDateShort(dateIso: string, offsetMin: number): string {
  return dayjs.utc(`${dateIso}T12:00:00Z`).utcOffset(offsetMin).format("ddd D");
}

export function dayStartIso(dateIso: string, offsetMin: number): string {
  const ms = Date.parse(`${dateIso}T00:00:00Z`) - offsetMin * 60_000;
  return new Date(ms).toISOString();
}

export function dayEndIso(dateIso: string, offsetMin: number): string {
  const ms = Date.parse(`${dateIso}T00:00:00Z`) - offsetMin * 60_000 + 24 * 60 * 60 * 1000 - 1;
  return new Date(ms).toISOString();
}

export function previousDayIso(current: string): string {
  return dayjs.utc(current).subtract(1, "day").format("YYYY-MM-DD");
}

export function nextDayIso(current: string): string {
  return dayjs.utc(current).add(1, "day").format("YYYY-MM-DD");
}

export function previousWeekStartIso(current: string): string {
  return dayjs.utc(current).subtract(7, "day").format("YYYY-MM-DD");
}

export function nextWeekStartIso(current: string): string {
  return dayjs.utc(current).add(7, "day").format("YYYY-MM-DD");
}

export function todayIso(offsetMin: number = DEFAULT_OFFSET_MIN): string {
  return dayjs().utcOffset(offsetMin).format("YYYY-MM-DD");
}

export function weekStartIso(anyDay: string): string {
  const d = dayjs.utc(anyDay);
  const dayOfWeek = d.day();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return d.add(mondayOffset, "day").format("YYYY-MM-DD");
}

export function weekdayLabels(weekStart: string, offsetMin: number): { iso: string; label: string }[] {
  const base = dayjs.utc(weekStart);
  const out: { iso: string; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = base.add(i, "day");
    const iso = d.format("YYYY-MM-DD");
    out.push({ iso, label: dayjs.utc(`${iso}T12:00:00Z`).utcOffset(offsetMin).format("ddd D") });
  }
  return out;
}

export const HEIGHT_EMPTY = 20;
export const HEIGHT_BUSY = 90;

export interface HourInfo {
  hour: number;
  hasEvents: boolean;
  top: number;
  height: number;
}

export function computeDayHourHasEvents(
  dayIso: string,
  offsetMin: number,
  sessions: { startUtc: string; endUtc: string; isEstimatedStart?: boolean }[],
): Record<number, boolean> {
  const result: Record<number, boolean> = {};
  for (let h = 0; h < 24; h++) result[h] = false;
  const start = dayStartIso(dayIso, offsetMin);
  const end = dayEndIso(dayIso, offsetMin);
  const daySessions = sessions.filter(
    (s) => s.startUtc < end && s.endUtc > start && !s.isEstimatedStart,
  );
  const startMs = Date.parse(start);
  for (const s of daySessions) {
    const sStart = Math.max(0, (Date.parse(s.startUtc) - startMs) / 60_000);
    const sEnd = Math.min(1440, (Date.parse(s.endUtc) - startMs) / 60_000);
    const firstHour = Math.floor(sStart / 60);
    const lastHour = Math.min(23, Math.ceil(sEnd / 60) - 1);
    for (let h = firstHour; h <= lastHour; h++) result[h] = true;
  }
  return result;
}

export function computeWeekHourHasEvents(
  days: { iso: string }[],
  offsetMin: number,
  sessions: { startUtc: string; endUtc: string; isEstimatedStart?: boolean }[],
): Record<number, boolean> {
  const result: Record<number, boolean> = {};
  for (let h = 0; h < 24; h++) result[h] = false;
  for (const day of days) {
    const dayHas = computeDayHourHasEvents(day.iso, offsetMin, sessions);
    for (let h = 0; h < 24; h++) {
      if (dayHas[h]) result[h] = true;
    }
  }
  return result;
}

export function buildHourInfos(hourHasEvents: Record<number, boolean>): HourInfo[] {
  let top = 0;
  const out: HourInfo[] = [];
  for (let h = 0; h < 24; h++) {
    const hasEvents = hourHasEvents[h];
    const height = hasEvents ? HEIGHT_BUSY : HEIGHT_EMPTY;
    out.push({ hour: h, hasEvents, top, height });
    top += height;
  }
  return out;
}

export function getSessionPosition(
  sessionStartUtc: string,
  durationMin: number,
  dayStartIsoStr: string,
  hourInfos: HourInfo[],
): { top: number; height: number } {
  const startMs = Date.parse(dayStartIsoStr);
  const startMin = Math.max(0, (Date.parse(sessionStartUtc) - startMs) / 60_000);
  const endMin = Math.min(1440, startMin + durationMin);
  const startHour = Math.max(0, Math.min(23, Math.floor(startMin / 60)));
  const startMinInHour = Math.max(0, startMin - startHour * 60);
  const endHour = Math.max(0, Math.min(23, Math.floor(endMin / 60)));
  const endMinInHour = endMin - endHour * 60;

  const info = hourInfos[startHour];
  const top = info.top + (startMinInHour / 60) * info.height;

  let height: number;
  if (startHour === endHour || endHour < startHour) {
    height = ((durationMin) / 60) * info.height;
  } else {
    height = ((60 - startMinInHour) / 60) * hourInfos[startHour].height;
    for (let h = startHour + 1; h < endHour; h++) {
      height += hourInfos[h].height;
    }
    height += (endMinInHour / 60) * hourInfos[endHour].height;
  }

  return { top, height: Math.max(24, height) };
}

export function daysWithSessionsInWeek(
  weekStart: string,
  sessions: { startUtc: string; endUtc: string }[],
  offsetMin: number,
): string[] {
  const base = dayjs.utc(weekStart);
  const days: { iso: string; start: number; end: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const iso = base.add(i, "day").format("YYYY-MM-DD");
    const startMs = Date.parse(`${iso}T00:00:00Z`) - offsetMin * 60_000;
    const endMs = startMs + 24 * 60 * 60 * 1000 - 1;
    days.push({ iso, start: startMs, end: endMs });
  }
  const present = new Set<string>();
  for (const s of sessions) {
    const sStart = Date.parse(s.startUtc);
    const sEnd = Date.parse(s.endUtc);
    for (const d of days) {
      if (sStart <= d.end && sEnd >= d.start) {
        present.add(d.iso);
      }
    }
  }
  return days.filter((d) => present.has(d.iso)).map((d) => d.iso);
}

export { dayjs };