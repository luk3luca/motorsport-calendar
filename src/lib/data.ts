import type { CalendarData, Session } from "@/types";
import { classifySessionType, estimateDurationMin } from "@/lib/sources/durations";

import calendarData from "../../data/calendar-2026.json";

function applyDurationOverride(s: Session): Session {
  if (!s.isEstimatedEnd) return s;
  const sessionType = classifySessionType(s.name);
  const { durationMin, isEstimatedEnd } = estimateDurationMin(s.series, sessionType, s.name);
  if (durationMin === s.durationMin && sessionType === s.sessionType) return s;
  const startMs = Date.parse(s.startUtc);
  return {
    ...s,
    sessionType,
    durationMin,
    endUtc: new Date(startMs + durationMin * 60_000).toISOString(),
    isEstimatedEnd,
  };
}

export function getCalendar(): CalendarData {
  const data = JSON.parse(JSON.stringify(calendarData)) as CalendarData;
  data.sessions = data.sessions.map(applyDurationOverride);
  return data;
}

export function getAllSessions(): Session[] {
  return getCalendar().sessions;
}

export function getSessionsInWindow(startIso: string, endIso: string): Session[] {
  return getCalendar().sessions.filter(
    (s) => s.startUtc <= endIso && s.endUtc >= startIso,
  );
}

export function getSessionsOnDay(dayIso: string): Session[] {
  return getCalendar().sessions.filter((s) => {
    const sStart = s.startUtc.slice(0, 10);
    const sEnd = s.endUtc.slice(0, 10);
    return sStart <= dayIso && sEnd >= dayIso;
  });
}

export function getSessionsForWeek(weekStartIso: string): Session[] {
  const start = new Date(`${weekStartIso}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return getSessionsInWindow(
    start.toISOString(),
    new Date(end.getTime() - 1).toISOString(),
  ).filter((s) => s.startUtc < end.toISOString());
}

export function getWeekends(): { eventKey: string; firstStart: string; label: string }[] {
  const map = new Map<string, { firstStart: string; label: string }>();
  for (const s of getCalendar().sessions) {
    const k = s.eventKey;
    if (!k) continue;
    const existing = map.get(k);
    const label = prettyWeekendLabel(s.name, k);
    if (!existing || s.startUtc < existing.firstStart) {
      map.set(k, { firstStart: s.startUtc, label });
    }
  }
  return Array.from(map.entries()).map(([eventKey, v]) => ({
    eventKey,
    firstStart: v.firstStart,
    label: v.label,
  }));
}

function prettyWeekendLabel(eventName: string, eventKey: string): string {
  let label = eventName;
  for (const kw of [
    "Free Practice",
    "Practice",
    "Sprint Qualifying",
    "Sprint Shootout",
    "Sprint Race",
    "Sprint",
    "Feature Race",
    "Qualifying",
    "Race",
    "Testing",
    "Test",
    "Shakedown",
  ]) {
    const idx = label.indexOf(kw);
    if (idx > 0) {
      label = label.slice(0, idx).trim();
      break;
    }
  }
  label = label.replace(/\b\d{4}$|\bRound\s*\d+/i, "").trim();
  return label || eventKey;
}