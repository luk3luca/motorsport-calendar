import type { SeriesId, SessionType } from "@/types";

const DURATION_TABLE_MIN: Record<SeriesId, Partial<Record<SessionType, number>>> = {
  f1: {
    free_practice: 60,
    practice: 60,
    qualifying: 60,
    sprint_qualifying: 60,
    sprint: 60,
    race: 120,
    test: 480,
  },
  f2: {
    practice: 45,
    qualifying: 30,
    sprint_race: 60,
    feature_race: 120,
    race: 120,
  },
  f3: {
    practice: 45,
    qualifying: 30,
    sprint_race: 60,
    feature_race: 120,
    race: 120,
  },
  f1_academy: {
    free_practice: 40,
    practice: 40,
    qualifying: 30,
    race: 60,
  },
  motogp: {
    practice: 45,
    free_practice: 45,
    qualifying: 15,
    sprint: 20,
    race: 45,
    warmup: 20,
  },
  moto2: {
    practice: 40,
    free_practice: 40,
    qualifying: 15,
    race: 40,
    warmup: 20,
  },
  moto3: {
    practice: 40,
    free_practice: 40,
    qualifying: 15,
    race: 35,
    warmup: 20,
  },
  formula_e: {
    free_practice: 30,
    practice: 30,
    qualifying: 30,
    race: 60,
  },
  indycar: {
    practice: 45,
    free_practice: 45,
    qualifying: 30,
    race: 120,
    warmup: 30,
  },
  wec: {
    practice: 90,
    free_practice: 90,
    qualifying: 60,
    race: 0,
  },
  wrc: {
    race: 0,
  },
  nascar: {
    practice: 50,
    qualifying: 30,
    race: 180,
  },
  sbk: {
    practice: 45,
    free_practice: 45,
    qualifying: 25,
    race: 40,
    warmup: 20,
  },
  dtm: {
    practice: 45,
    free_practice: 45,
    qualifying: 30,
    race: 60,
  },
  imsa: {
    practice: 60,
    free_practice: 60,
    qualifying: 30,
    race: 0,
  },
};

const FALLBACK_MIN = 90;

function parseHoursFromName(name: string): number | null {
  const m = name.match(/(\d+)\s*hours?(?:\s+of)?/i);
  if (m) return parseInt(m[1], 10) * 60;
  const m2 = name.match(/\b(\d+)h\b/i);
  if (m2) return parseInt(m2[1], 10) * 60;
  return null;
}

export function classifySessionType(name: string): SessionType {
  const n = name.toLowerCase();
  if (/\bfree\s+practice\s*1\b|\bfp1\b|\bpractice\s*1\b|\bp1\b/i.test(n)) return "free_practice";
  if (/\bsprint\s+qualifying\b|\bsprint\s+shootout\b|\bsq\b/i.test(n)) return "sprint_qualifying";
  if (/\bsprint\s+race\b|\bsprint\b(?!.*qualifying)/i.test(n)) return "sprint";
  if (/sprint/i.test(n) && /race/i.test(n)) return "sprint_race";
  if (/\bfeature\s+race\b|\bfeature\b/i.test(n)) return "feature_race";
  if (/\bqualifying\b|\bqual\b|\bpole\b|\bgrid\b/i.test(n)) return "qualifying";
  if (/\bfree\s+practice\b|\bfp\b|\bpractice\b/i.test(n)) return "practice";
  if (/\bwarm\s*up\b|\bwarmup\b/i.test(n)) return "warmup";
  if (/\btest(ing)?\b|\bshakedown\b/i.test(n)) return "test";
  if (/\brace\b|\bgrand\s+prix\b(?!.*qualifying)|\bgp\b(?!.*qualifying)|\beprix\b|\be-prix\b|\b201\b|\b200\b/i.test(n))
    return "race";
  return "other";
}

export function estimateDurationMin(
  series: SeriesId,
  sessionType: SessionType,
  name: string,
): { durationMin: number; isEstimatedEnd: boolean } {
  const hoursFromName = parseHoursFromName(name);
  if (hoursFromName && (sessionType === "race" || sessionType === "other")) {
    return { durationMin: hoursFromName, isEstimatedEnd: true };
  }
  const table = DURATION_TABLE_MIN[series];
  const d = table?.[sessionType];
  if (d && d > 0) return { durationMin: d, isEstimatedEnd: true };
  return { durationMin: FALLBACK_MIN, isEstimatedEnd: true };
}

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  free_practice: "Free Practice",
  practice: "Practice",
  qualifying: "Qualifying",
  sprint_qualifying: "Sprint Qualifying",
  sprint: "Sprint",
  sprint_race: "Sprint Race",
  feature_race: "Feature Race",
  race: "Race",
  warmup: "Warm-up",
  test: "Test",
  other: "Session",
};