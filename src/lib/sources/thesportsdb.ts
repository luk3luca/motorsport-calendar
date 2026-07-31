import type { Session, SeriesId, SessionType } from "@/types";
import { classifySessionType, estimateDurationMin } from "@/lib/sources/durations";
import { LEAGUES, LEAGUE_BY_SERIES } from "@/lib/sources/leagues";
import { venueTimezone, localToUtc, utcDiffMinutes } from "@/lib/sources/venue-tz";

const API_BASE = "https://www.thesportsdb.com/api/v1/json";
const FREE_API_KEY = "123";

export interface TsdEvent {
  idEvent: string;
  strEvent: string;
  strSport: string;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  intRound: string | null;
  strTimestamp: string | null;
  dateEvent: string | null;
  strTime: string | null;
  strTimeLocal: string | null;
  strVenue: string | null;
  strCountry: string | null;
  strCity: string | null;
  strMap: string | null;
}

export interface TsdResponse {
  events: TsdEvent[] | null;
}

const CC_TO_FLAG: Record<string, string> = {
  Italy: "\u{1F1EE}\u{1F1F9}",
  UnitedKingdom: "\u{1F1EC}\u{1F1E7}",
  "United Kingdom": "\u{1F1EC}\u{1F1E7}",
  GreatBritain: "\u{1F1EC}\u{1F1E7}",
  Germany: "\u{1F1E9}\u{1F1EA}",
  France: "\u{1F1EB}\u{1F1F7}",
  Spain: "\u{1F1EA}\u{1F1F8}",
  Netherlands: "\u{1F1F3}\u{1F1F1}",
  Belgium: "\u{1F1E7}\u{1F1EA}",
  Austria: "\u{1F1E6}\u{1F1F8}",
  Hungary: "\u{1F1ED}\u{1F1FA}",
  Switzerland: "\u{1F1E8}\u{1F1ED}",
  Japan: "\u{1F1EF}\u{1F1F5}",
  China: "\u{1F1E8}\u{1F1F3}",
  Australia: "\u{1F1E6}\u{1F1FA}",
  Bahrain: "\u{1F1E7}\u{1F1ED}",
  "SaudiArabia": "\u{1F1F8}\u{1F1E6}",
  "Saudi Arabia": "\u{1F1F8}\u{1F1E6}",
  USA: "\u{1F1FA}\u{1F1F8}",
  "United States": "\u{1F1FA}\u{1F1F8}",
  Canada: "\u{1F1E8}\u{1F1E6}",
  Brazil: "\u{1F1E7}\u{1F1F7}",
  Mexico: "\u{1F1F2}\u{1F1FD}",
  UAE: "\u{1F1E6}\u{1F1EA}",
  "United Arab Emirates": "\u{1F1E6}\u{1F1EA}",
  Qatar: "\u{1F1F6}\u{1F1E6}",
  Singapore: "\u{1F1F8}\u{1F1EC}",
  Azerbaijan: "\u{1F1E6}\u{1F1FF}",
  Monaco: "\u{1F1F2}\u{1F1E8}",
  Russia: "\u{1F1F7}\u{1F1FA}",
  Malaysia: "\u{1F1F2}\u{1F1FE}",
  Thailand: "\u{1F1F9}\u{1F1ED}",
  Argentina: "\u{1F1E6}\u{1F1F7}",
  Portugal: "\u{1F1F5}\u{1F1F9}",
  Turkey: "\u{1F1F9}\u{1F1F7}",
  Belgium2: "\u{1F1E7}\u{1F1EA}",
  SouthAfrica: "\u{1F1FF}\u{1F1E6}",
  "South Africa": "\u{1F1FF}\u{1F1E6}",
  Sweden: "\u{1F1F8}\u{1F1ED}",
  Norway: "\u{1F1F3}\u{1F1F4}",
  Finland: "\u{1F1EB}\u{1F1EE}",
  Denmark: "\u{1F1E9}\u{1F1F0}",
  Poland: "\u{1F1F5}\u{1F1F1}",
  "Czech Republic": "\u{1F1E8}\u{1F1FF}",
  "CzechRepublic": "\u{1F1E8}\u{1F1FF}",
  Greece: "\u{1F1EC}\u{1F1F7}",
  Romania: "\u{1F1F7}\u{1F1F4}",
  Croatia: "\u{1F1ED}\u{1F1F7}",
  Serbia: "\u{1F1F7}\u{1F1F8}",
  Slovenia: "\u{1F1F8}\u{1F1EE}",
  Slovakia: "\u{1F1F8}\u{1F1F0}",
  Ireland: "\u{1F1EE}\u{1F1EA}",
  Indonesia: "\u{1F1EE}\u{1F1E9}",
  India: "\u{1F1EE}\u{1F1F3}",
  SouthKorea: "\u{1F1F0}\u{1F1F7}",
  "South Korea": "\u{1F1F0}\u{1F1F7}",
  Chile: "\u{1F1E8}\u{1F1F1}",
  Colombia: "\u{1F1E8}\u{1F1F4}",
  Peru: "\u{1F1EA}\u{1F1F5}",
  Ecuador: "\u{1F1E8}\u{1F1EC}",
  Uruguay: "\u{1F1FA}\u{1F1FE}",
  Paraguay: "\u{1F1F5}\u{1F1FE}",
  "San Marino": "\u{1F1F8}\u{1F1F2}",
  SanMarino: "\u{1F1F8}\u{1F1F2}",
  Luxembourg: "\u{1F1F1}\u{1F1FA}",
  Andorra: "\u{1F1E6}\u{1F1E9}",
  Morocco: "\u{1F1F2}\u{1F1E6}",
  Egypt: "\u{1F1EA}\u{1F1EC}",
  Kenya: "\u{1F1F0}\u{1F1EA}",
  Rwanda: "\u{1F1F7}\u{1F1FC}",
  Zambia: "\u{1F1FF}\u{1F1F2}",
  Namibia: "\u{1F1F3}\u{1F1F0}",
  Botswana: "\u{1F1E7}\u{1F1E6}",
  Estonia: "\u{1F1EA}\u{1F1EA}",
  Latvia: "\u{1F1F1}\u{1F1EE}",
  Lithuania: "\u{1F1F1}\u{1F1FE}",
  Iceland: "\u{1F1EE}\u{1F1F8}",
  NewZealand: "\u{1F1F3}\u{1F1FF}",
  "New Zealand": "\u{1F1F3}\u{1F1FF}",
  International: "",
};

export function countryToFlag(country: string | null | undefined): string {
  if (!country) return "";
  if (CC_TO_FLAG[country]) return CC_TO_FLAG[country];
  return "";
}

const leagueIdToSeries: Record<number, SeriesId> = Object.fromEntries(
  LEAGUES.map((l) => [l.leagueId, l.series]),
) as Record<number, SeriesId>;

const SESSION_KEYWORDS = [
  "Free Practice",
  "Practice 1",
  "Practice 2",
  "Practice 3",
  "Practice 4",
  "Practice",
  "Sprint Qualifying",
  "Sprint Shootout",
  "Sprint Race",
  "Sprint",
  "Feature Race",
  "Qualifying",
  "Quali",
  "Warm-up",
  "Warm Up",
  "Warmup",
  "Race",
  "Testing",
  "Test",
  "Shakedown",
  "Reconnaissance",
  "Drivers Parade",
];

export function buildEventKey(eventName: string): string {
  let key = eventName;
  for (const kw of SESSION_KEYWORDS) {
    const idx = key.indexOf(kw);
    if (idx > 0) {
      key = key.slice(0, idx).trim();
      break;
    }
  }
  key = key.replace(/\b\d{4}$|\bRound\s*\d+/i, "").trim();
  key = key.replace(/[\s_]+/g, "_").toLowerCase();
  return key || eventName.toLowerCase().replace(/\s+/g, "_");
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchEventsDayLeague(
  dateIso: string,
  leagueId: number,
  apiKey: string = FREE_API_KEY,
  signal?: AbortSignal,
): Promise<TsdEvent[]> {
  const url = `${API_BASE}/${apiKey}/eventsday.php?d=${encodeURIComponent(dateIso)}&l=${leagueId}`;
  const res = await fetch(url, { signal });
  if (res.status === 429) throw new TsdRateLimitError();
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = (await res.json()) as TsdResponse;
  return json.events ?? [];
}

export class TsdRateLimitError extends Error {
  constructor() {
    super("TheSportsDB rate limit (429) hit");
    this.name = "TsdRateLimitError";
  }
}

export function normalizeTsdEvent(e: TsdEvent): Session | null {
  const series = leagueIdToSeries[Number(e.idLeague)];
  if (!series) return null;
  if (!e.strTimestamp) return null;

  /* ------------------------------------------------------------------ */
  /*  Resolve start UTC                                                   */
  /*  Prefer local track time + venue IANA timezone (DST-aware).          */
  /*  Fall back to TheSportsDB strTimestamp as before.                    */
  /* ------------------------------------------------------------------ */
  let startUtc = e.strTimestamp.endsWith("Z") ? e.strTimestamp : `${e.strTimestamp}Z`;

  const tz = venueTimezone(e.strVenue);
  if (tz && e.strTimeLocal) {
    const dateStr = e.dateEvent ?? e.strTimestamp.slice(0, 10);
    const computed = localToUtc(dateStr, e.strTimeLocal, tz);
    if (computed) {
      // Sanity check: if the declared timestamp differs wildly from the
      // local-time-derived one, prefer the local-derived value.
      if (utcDiffMinutes(startUtc, computed) >= 60) {
        startUtc = computed;
      }
    }
  }

  const sessionType: SessionType = classifySessionType(e.strEvent);
  const { durationMin, isEstimatedEnd } = estimateDurationMin(series, sessionType, e.strEvent);
  const startMs = Date.parse(startUtc);
  if (Number.isNaN(startMs)) return null;
  const endMs = startMs + durationMin * 60_000;
  const leagueMeta = LEAGUE_BY_SERIES[series];
  const round = e.intRound ? Number(e.intRound) : null;
  const ts = e.strTimestamp ?? "";
  const hasMidnightTs = ts.endsWith("T00:00:00") || ts.endsWith("T00:00:00Z");
  const isEstimatedStart = !e.strTime || e.strTime === "00:00:00" || hasMidnightTs;
  return {
    id: e.idEvent,
    series,
    leagueName: e.strLeague ?? leagueMeta.label,
    name: e.strEvent,
    sessionType,
    eventKey: buildEventKey(e.strEvent),
    round: Number.isFinite(round) ? round : null,
    season: e.strSeason ?? "",
    startUtc,
    endUtc: new Date(endMs).toISOString(),
    durationMin,
    venue: e.strVenue ?? "",
    country: e.strCountry ?? "",
    countryFlagEmoji: countryToFlag(e.strCountry),
    city: e.strCity ?? null,
    mapUrl: e.strMap ?? null,
    isEstimatedStart,
    isEstimatedEnd,
  };
}

export async function fetchDayWithThrottle(
  dateIso: string,
  leagueId: number,
  apiKey: string = FREE_API_KEY,
  signal?: AbortSignal,
): Promise<Session[]> {
  const events = await fetchEventsDayLeague(dateIso, leagueId, apiKey, signal);
  const sessions: Session[] = [];
  for (const e of events) {
    const s = normalizeTsdEvent(e);
    if (s) sessions.push(s);
  }
  return sessions;
}

export { wait };