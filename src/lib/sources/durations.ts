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
    sprint_race: 45,
    feature_race: 50,
    race: 120,
  },
  f3: {
    practice: 45,
    qualifying: 30,
    sprint_race: 45,
    feature_race: 50,
    race: 120,
  },
  f1_academy: {
    free_practice: 40,
    practice: 40,
    qualifying: 30,
    race: 30,
  },
  motogp: {
    practice: 60,
    free_practice: 45,
    qualifying: 40,
    sprint: 25,
    race: 45,
    warmup: 20,
  },
  moto2: {
    practice: 40,
    free_practice: 40,
    qualifying: 40,
    race: 40,
    warmup: 20,
  },
  moto3: {
    practice: 35,
    free_practice: 35,
    qualifying: 40,
    race: 35,
    warmup: 20,
  },
  formula_e: {
    free_practice: 30,
    practice: 30,
    qualifying: 60,
    race: 48,
  },
  indycar: {
    practice: 45,
    free_practice: 45,
    qualifying: 60,
    race: 120,
    warmup: 30,
  },
  wec: {
    practice: 90,
    free_practice: 90,
    qualifying: 45,
    race: 0,
  },
  nascar: {
    practice: 50,
    qualifying: 30,
    race: 210,
  },
  dtm: {
    practice: 45,
    free_practice: 45,
    qualifying: 20,
    race: 60,
  },
  imsa: {
    practice: 60,
    free_practice: 60,
    qualifying: 45,
    race: 0,
  },
};

const FALLBACK_MIN = 90;

/**
 * Parse race duration from name patterns like "6 Hours", "24h", "1812 KM".
 * Returns minutes, or null if no pattern matched.
 * Skips names containing "hyperpole" or "Hyperpole" since those are short sessions
 * that happen to include the race duration in their name.
 */
function parseDurationFromName(name: string): number | null {
  // Skip hyperpole sessions — they include "6 Hours" in the name but are short
  if (/\bhyperpole\b/i.test(name)) return null;

  // "6 Hours of São Paulo" → 360 min, "8 Hours of Bahrain" → 480 min
  const hours = name.match(/(\d+)\s*h(?:ours?)?(?:\s+of)?/i);
  if (hours) return parseInt(hours[1], 10) * 60;

  // "24h" → 1440 min
  const short = name.match(/\b(\d+)h\b/i);
  if (short) return parseInt(short[1], 10) * 60;

  return null;
}

export function classifySessionType(name: string): SessionType {
  const n = name.toLowerCase();

  // Free Practice 1 / FP1 / Practice 1 / P1 / Free Practice Nr. 1
  // Also Free Practice 2 / FP2 / Practice 2 / Free Practice Nr. 2
  if (/\bfree\s+practice\s*(?:nr\.?\s*)?[12]\b|\bfp[12]\b|\bpractice\s*(?:nr\.?\s*)?[12]\b|\bp[12]\b/i.test(n))
    return "free_practice";

  // Sprint Qualifying / Sprint Shootout / SQ
  if (/\bsprint\s+qualifying\b|\bsprint\s+shootout\b|\bsq\b/i.test(n))
    return "sprint_qualifying";

  // Sprint Race (explicit two-word pattern)
  if (/\bsprint\s+race\b/i.test(n))
    return "sprint_race";

  // Sprint (standalone — not part of qualifying or race)
  if (/\bsprint\b(?!.*qualifying)(?!.*\brace\b)/i.test(n))
    return "sprint";

  // Both "sprint" and "race" present but non-adjacent
  if (/sprint/i.test(n) && /race/i.test(n))
    return "sprint_race";

  // Feature Race
  if (/\bfeature\s+race\b|\bfeature\b/i.test(n))
    return "feature_race";

  // Hyperpole (WEC qualifying shootout) — classify as qualifying
  if (/\bhyperpole\b/i.test(n))
    return "qualifying";

  // Qualifying / Qual / Pole / Grid (but NOT "Reverse Grid Race" — that's a race)
  if (/\bqualifying\b|\bqual\b|\bpole\b|\bgrid\b(?!\s*race)/i.test(n))
    return "qualifying";

  // Free Practice / FP / Practice
  if (/\bfree\s+practice\b|\bfp\b|\bpractice\b/i.test(n))
    return "practice";

  // Warm-up / Warmup
  if (/\bwarm\s*up\b|\bwarmup\b/i.test(n))
    return "warmup";

  // Test / Shakedown
  if (/\btest(ing)?\b|\bshakedown\b/i.test(n))
    return "test";

  // ---- RACE PATTERNS ----

  // Endurance races: "6 Hours of São Paulo", "24 Hours of Le Mans", "8h"
  if (/\b\d+\s*h(?:ours?)?(?:\s+of)?\b/i.test(n))
    return "race";

  // Distance-based races: "Qatar 1812 KM"
  if (/\b\d+\s*km\b/i.test(n))
    return "race";

  // Le Mans races: "Motul Petit Le Mans", "Lone Star Le Mans"
  if (/\b(?:le\s+)?mans\b/i.test(n))
    return "race";

  // Rally events (WRC)
  if (/\brally\b/i.test(n))
    return "race";

  // Non-English "Grand Prix": Gran Premio, Grande Prémio, Große Preis, Grote Prijs
  if (/\bgran[dt]?e?\s*pr[éeè]mio\b|\bgro[ßße]+\s+preis\b|\bgrote\s+prijs\b/i.test(n))
    return "race";

  // English "Grand Prix" / "GP" / "ePrix"
  if (/\brace\b|\bgrand\s+prix\b(?!.*qualifying)|\bgp\b(?!.*qualifying)|\beprix\b|\be-prix\b|\b201\b|\b200\b/i.test(n))
    return "race";

  // Distance-numbered races (NASCAR: "Quaker State 400", "Cook Out Southern 500")
  // Matches 3-digit numbers 150-999 at the end of the string
  if (/\b(?:[1-4]\d{2}|5[0-9]{2}|[6-9]\d{2})\s*$/.test(n))
    return "race";

  return "other";
}

export function estimateDurationMin(
  series: SeriesId,
  sessionType: SessionType,
  name: string,
): { durationMin: number; isEstimatedEnd: boolean } {
  // For races that mention hours (e.g. "6 Hours of São Paulo"), use the named duration
  const durationFromName = parseDurationFromName(name);
  if (durationFromName && (sessionType === "race" || sessionType === "other")) {
    return { durationMin: durationFromName, isEstimatedEnd: true };
  }

  // Look up duration from series table
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
