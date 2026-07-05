import type { Session, SeriesId } from "@/types";
import { LEAGUE_BY_SERIES } from "@/lib/sources/leagues";

/* ------------------------------------------------------------------ */
/*  Types returned by the FIA F2 / F3 website's embedded JSON          */
/* ------------------------------------------------------------------ */

interface FiaSession {
  SessionId: number;
  SessionCode: "PRACTICE" | "QUALIFYING" | "RESULT";
  SessionName: string;
  SessionShortName: string;
  Unconfirmed: boolean;
  SessionStartTime: string; // ISO 8601 with timezone offset
  SessionEndTime: string;
}

interface FiaRace {
  RaceId: number;
  RoundNumber: number;
  RaceStartDate: string;
  RaceEndDate: string;
  CircuitId: number;
  CountryCode: string;
  CountryName: string;
  CircuitName: string;
  CircuitShortName: string;
  Sessions: FiaSession[];
}

interface FiaCalendarResponse {
  props: {
    pageProps: {
      pageData: {
        SeasonId: number;
        SeasonName: string;
        Races: FiaRace[];
      };
    };
  };
}

export interface SuppliedSession extends Session {
  /** The FIA source prefers exact times over estimated ones */
  fromFia: true;
}

/* ------------------------------------------------------------------ */
/*  Series-to-URL mapping                                              */
/* ------------------------------------------------------------------ */

const FIA_SERIES_URLS: Partial<Record<SeriesId, string>> = {
  f2: "https://www.fiaformula2.com/Calendar",
  f3: "https://www.fiaformula3.com/Calendar",
};

/* ------------------------------------------------------------------ */
/*  Session type classification                                        */
/* ------------------------------------------------------------------ */

interface Classified {
  sessionType: string; // SessionType
  nameOverride: string | null; // if we want a cleaner name
}

function classifyFiaSession(sessionCode: string, sessionName: string): Classified {
  const code = sessionCode.toUpperCase();
  const name = sessionName.toLowerCase();

  if (code === "PRACTICE" || name.includes("practice")) {
    return { sessionType: "practice", nameOverride: null };
  }

  if (code === "QUALIFYING" || name.includes("qualifying")) {
    if (name.includes("group")) {
      return { sessionType: "qualifying", nameOverride: sessionName };
    }
    return { sessionType: "qualifying", nameOverride: null };
  }

  if (name.includes("sprint") && name.includes("race")) {
    return { sessionType: "sprint_race", nameOverride: null };
  }

  if (name.includes("feature")) {
    return { sessionType: "feature_race", nameOverride: null };
  }

  if (name.includes("sprint")) {
    return { sessionType: "sprint", nameOverride: null };
  }

  if (name.includes("reverse grid")) {
    return { sessionType: "sprint", nameOverride: "Reverse Grid Race" };
  }

  // RESULT with no recognised keyword → assume feature race if it's the last session, else race
  if (code === "RESULT") {
    return { sessionType: "race", nameOverride: null };
  }

  return { sessionType: "other", nameOverride: null };
}

/* ------------------------------------------------------------------ */
/*  Country code → flag emoji (simple mapping, reused from thesportsdb)*/
/* ------------------------------------------------------------------ */

const CC_TO_FLAG: Record<string, string> = {
  GB: "\u{1F1EC}\u{1F1E7}",
  AU: "\u{1F1E6}\u{1F1FA}",
  US: "\u{1F1FA}\u{1F1F8}",
  CA: "\u{1F1E8}\u{1F1E6}",
  MC: "\u{1F1F2}\u{1F1E8}",
  ES: "\u{1F1EA}\u{1F1F8}",
  AT: "\u{1F1E6}\u{1F1F9}",
  BE: "\u{1F1E7}\u{1F1EA}",
  HU: "\u{1F1ED}\u{1F1FA}",
  IT: "\u{1F1EE}\u{1F1F9}",
  AZ: "\u{1F1E6}\u{1F1FF}",
  QA: "\u{1F1F6}\u{1F1E6}",
  AE: "\u{1F1E6}\u{1F1EA}",
  CN: "\u{1F1E8}\u{1F1F3}",
  BH: "\u{1F1E7}\u{1F1ED}",
  SA: "\u{1F1F8}\u{1F1E6}",
  NL: "\u{1F1F3}\u{1F1F1}",
  JP: "\u{1F1EF}\u{1F1F5}",
  BR: "\u{1F1E7}\u{1F1F7}",
  FR: "\u{1F1EB}\u{1F1F7}",
  DE: "\u{1F1E9}\u{1F1EA}",
  PT: "\u{1F1F5}\u{1F1F9}",
  // Fallback: derive from alpha-2 code
};

function countryCodeToFlag(code: string | null | undefined): string {
  if (!code) return "";
  const upper = code.toUpperCase();
  if (CC_TO_FLAG[upper]) return CC_TO_FLAG[upper];
  // Derive from regional indicator symbols
  if (/^[A-Z]{2}$/.test(upper)) {
    return String.fromCodePoint(upper.charCodeAt(0) + 0x1f1e6 - 65, upper.charCodeAt(1) + 0x1f1e6 - 65);
  }
  return "";
}

/* ------------------------------------------------------------------ */
/*  Build eventKey from circuit name                                   */
/* ------------------------------------------------------------------ */

function buildEventKey(circuitShortName: string): string {
  return circuitShortName.toLowerCase().replace(/[\s_]+/g, "_");
}

/* ------------------------------------------------------------------ */
/*  Main fetch function                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch the full season calendar for an FIA-series website.
 * Returns an array of Session objects compatible with CalendarData.
 */
export async function fetchFiaSeriesCalendar(series: SeriesId): Promise<Session[]> {
  const url = FIA_SERIES_URLS[series];
  if (!url) {
    console.warn(`[fia] No FIA source for series "${series}"`);
    return [];
  }

  const leagueMeta = LEAGUE_BY_SERIES[series];
  if (!leagueMeta) {
    console.warn(`[fia] No league metadata for series "${series}"`);
    return [];
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`FIA source HTTP ${res.status} for ${url}`);

  const html = await res.text();

  // Extract the JSON blob from the Next.js page
  const scriptMatch = html.match(
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/,
  );
  if (!scriptMatch) throw new Error(`No JSON embed found on ${url}`);

  const pageData: FiaCalendarResponse = JSON.parse(scriptMatch[1]);
  const races = pageData.props?.pageProps?.pageData?.Races;
  if (!races) throw new Error(`No race data found on ${url}`);

  const sessions: Session[] = [];

  for (const race of races) {
    // Build a eventKey from the circuit name, same as we do for TheSportsDB
    const eventKey = buildEventKey(race.CircuitShortName);

    for (const fiaSession of race.Sessions) {
      const classified = classifyFiaSession(fiaSession.SessionCode, fiaSession.SessionName);
      const sessionType = classified.sessionType as Session["sessionType"];
      const displayName = classified.nameOverride ?? fiaSession.SessionName;

      // Parse ISO 8601 timestamps with timezone offsets to UTC
      const startMs = Date.parse(fiaSession.SessionStartTime);
      const endMs = Date.parse(fiaSession.SessionEndTime);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;

      const durationMin = Math.round((endMs - startMs) / 60_000);

      sessions.push({
        id: `fia-${series}-${fiaSession.SessionId}`,
        series,
        leagueName: leagueMeta.label,
        name: `${race.CircuitShortName} ${displayName}`,
        sessionType,
        eventKey,
        round: race.RoundNumber,
        season: "2026",
        startUtc: new Date(startMs).toISOString(),
        endUtc: new Date(endMs).toISOString(),
        durationMin: durationMin > 0 ? durationMin : 45,
        venue: race.CircuitName,
        country: race.CountryName,
        countryFlagEmoji: countryCodeToFlag(race.CountryCode),
        city: null,
        mapUrl: null,
        isEstimatedStart: fiaSession.Unconfirmed,
        isEstimatedEnd: fiaSession.Unconfirmed,
      });
    }
  }

  return sessions;
}

/**
 * Return the list of SeriesId that have an FIA source.
 */
export function getFiaSeries(): SeriesId[] {
  return Object.keys(FIA_SERIES_URLS) as SeriesId[];
}
