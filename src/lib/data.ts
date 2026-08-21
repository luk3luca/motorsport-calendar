import type { CalendarData, Session } from "@/types";
import { classifySessionType, estimateDurationMin } from "@/lib/sources/durations";
import {
  DEFAULT_OFFSET_MIN,
  dayStartIso,
  dayEndIso,
  weekStartIso as toWeekStart,
} from "@/lib/timezone";

import calendarData from "../../data/calendar-2026.json";

// Enriched sessions are deterministic (derived from the static JSON import),
// so compute them once instead of deep-cloning on every getter call.
const ENRICHED_SESSIONS: Session[] = (() => {
  const data = calendarData as CalendarData;
  return data.sessions.map(applyDurationOverride);
})();

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
  data.sessions = ENRICHED_SESSIONS.map((s) => ({ ...s }));
  return data;
}

export function getAllSessions(): Session[] {
  return ENRICHED_SESSIONS;
}

export function getSessionsInWindow(startIso: string, endIso: string): Session[] {
  return getAllSessions().filter(
    (s) => s.startUtc <= endIso && s.endUtc >= startIso,
  );
}

export function getSessionsOnDay(dayIso: string): Session[] {
  return getSessionsInWindow(dayStartIso(dayIso, DEFAULT_OFFSET_MIN), dayEndIso(dayIso, DEFAULT_OFFSET_MIN));
}

export function getSessionsForWeek(weekStart: string): Session[] {
  // Window must be computed in viewer time so that sessions near the week
  // edges land on the same week the rendering helpers assign them to.
  const days: string[] = [];
  const base = toWeekStart(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.parse(`${base}T00:00:00Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    days.push(d);
  }
  const start = dayStartIso(days[0], DEFAULT_OFFSET_MIN);
  const end = dayEndIso(days[6], DEFAULT_OFFSET_MIN);
  return getSessionsInWindow(start, end);
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