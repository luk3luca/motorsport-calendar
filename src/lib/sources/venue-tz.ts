import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/* ------------------------------------------------------------------ */
/*  Venue → IANA timezone mapping (partial match, case-insensitive)    */
/* ------------------------------------------------------------------ */

const VENUE_TZ: Record<string, string> = {
  // ===== Europe =====
  // UK
  Silverstone: "Europe/London",
  Donnington: "Europe/London",
  Donington: "Europe/London",
  Brands: "Europe/London",
  Thruxton: "Europe/London",
  Oulton: "Europe/London",
  Knockhill: "Europe/London",
  Snetterton: "Europe/London",
  "Road Course": "Europe/London", // generic fallback for UK rounds
  // Italy
  Monza: "Europe/Rome",
  Misano: "Europe/Rome",
  Imola: "Europe/Rome",
  Mugello: "Europe/Rome",
  Cremona: "Europe/Rome",
  Vallelunga: "Europe/Rome",
  "Enzo e Dino Ferrari": "Europe/Rome",
  // Spain
  Barcelona: "Europe/Madrid",
  Cataluna: "Europe/Madrid",
  Catalunya: "Europe/Madrid",
  "Ricardo Tormo": "Europe/Madrid",
  MotorLand: "Europe/Madrid",
  "Motorland": "Europe/Madrid",
  Aragon: "Europe/Madrid",
  Jerez: "Europe/Madrid",
  "Hermanos Rodriguez": "America/Mexico_City", // Mexico City (F1) — not Spain
  // France
  "Le Mans": "Europe/Paris",
  Magny: "Europe/Paris",
  Paul: "Europe/Paris",
  Charade: "Europe/Paris",
  "Le Castellet": "Europe/Paris",
  // Germany
  Sachsenring: "Europe/Berlin",
  Hockenheim: "Europe/Berlin",
  Nurburgring: "Europe/Berlin",
  Norisring: "Europe/Berlin",
  Oschersleben: "Europe/Berlin",
  Lausitz: "Europe/Berlin",
  Assen: "Europe/Amsterdam",
  Zandvoort: "Europe/Amsterdam",
  Spa: "Europe/Brussels",
  Hungaroring: "Europe/Budapest",
  "Red Bull Ring": "Europe/Vienna",
  Spielberg: "Europe/Vienna",
  "Salzburgring": "Europe/Vienna",
  Algarve: "Europe/Lisbon",
  Estoril: "Europe/Lisbon",
  Portimao: "Europe/Lisbon",
  Monaco: "Europe/Monaco",
  "Baku": "Asia/Baku",
  "Yas Marina": "Asia/Dubai",
  "Madring": "Europe/Madrid",
  "Gilles-Villeneuve": "America/Toronto",
  "Autodromo Hermanos Rodriguez": "America/Mexico_City",

  // ===== Americas =====
  Interlagos: "America/Sao_Paulo",
  "Sao Paulo": "America/Sao_Paulo",
  "São Paulo": "America/Sao_Paulo",
  COTA: "America/Chicago",
  "Circuit of the Americas": "America/Chicago",
  Indianapolis: "America/Indiana/Indianapolis",
  Daytona: "America/New_York",
  Sebring: "America/New_York",
  Road: "America/New_York", // Road America / Road Atlanta
  "Road America": "America/Chicago",
  "Road Atlanta": "America/New_York",
  "Mid-Ohio": "America/New_York",
  "Mid Ohio": "America/New_York",
  "Canadian Tire": "America/Toronto",
  "Virginia International": "America/New_York",
  "Watkins Glen": "America/New_York",
  "Laguna Seca": "America/Los_Angeles",
  "Long Beach": "America/Los_Angeles",
  Portland: "America/Los_Angeles",
  Milwaukee: "America/Chicago",
  Iowa: "America/Chicago",
  "World Wide Technology": "America/Chicago",
  Gateway: "America/Chicago",
  "Las Vegas": "America/Los_Angeles",
  "Las Vegas Strip": "America/Los_Angeles",
  "Phoenix Raceway": "America/Phoenix",
  "Atlanta": "America/New_York",
  Bristol: "America/New_York",
  Darlington: "America/New_York",
  "Homestead": "America/New_York",
  Kansas: "America/Chicago",
  Martinsville: "America/New_York",
  Nashville: "America/Chicago",
  "New Hampshire": "America/New_York",
  Talladega: "America/Chicago",
  "Miami": "America/New_York",
  "Mexico": "America/Mexico_City",
  "Mexico City": "America/Mexico_City",
  "Hermanos": "America/Mexico_City",

  // ===== Asia / Oceania =====
  Fuji: "Asia/Tokyo",
  Motegi: "Asia/Tokyo",
  Suzuka: "Asia/Tokyo",
  Sepang: "Asia/Kuala_Lumpur",
  Mandalika: "Asia/Makassar",
  Lusail: "Asia/Qatar",
  Losail: "Asia/Qatar",
  Bahrain: "Asia/Bahrain",
  Shanghai: "Asia/Shanghai",
  "Marina Bay": "Asia/Singapore",
  "Tokyo": "Asia/Tokyo",
  "Phillip Island": "Australia/Melbourne",
  "Albert Park": "Australia/Melbourne",
  "Melbourne": "Australia/Melbourne",
  "Sydney": "Australia/Sydney",
  "Adelaide": "Australia/Adelaide",
  "Perth": "Australia/Perth",
  "Buriram": "Asia/Bangkok",
  "Yeongam": "Asia/Seoul",
  "Seoul": "Asia/Seoul",
  "Chang": "Asia/Bangkok",
  "Sentul": "Asia/Jakarta",
  "Jakarta": "Asia/Jakarta",
  "Dubai": "Asia/Dubai",
  "Jeddah": "Asia/Riyadh",
  "Riyadh": "Asia/Riyadh",
  "Doha": "Asia/Qatar",
  "Abu Dhabi": "Asia/Dubai",
  "Sakhir": "Asia/Bahrain",
};

/* ------------------------------------------------------------------ */
/*  Functions                                                          */
/* ------------------------------------------------------------------ */

/**
 * Find the IANA timezone for a venue name using partial matching
 * (case-insensitive substring match against the keys).
 *
 * Keys are tried LONGEST-FIRST so specific venues win over generic
 * substrings (e.g. "Road America" → America/Chicago must be checked
 * before the generic "Road" → America/New_York fallback).
 */
const VENUE_TZ_SORTED = Object.entries(VENUE_TZ).sort(
  ([a], [b]) => b.length - a.length,
);

export function venueTimezone(venue: string | null | undefined): string | null {
  if (!venue) return null;
  const v = venue.toLowerCase();
  for (const [key, tz] of VENUE_TZ_SORTED) {
    if (v.includes(key.toLowerCase())) return tz;
  }
  return null;
}

/**
 * Convert a local date+time to an ISO UTC string using an IANA timezone.
 * DST-aware thanks to dayjs timezone plugin.
 * Returns null if the input can't be parsed.
 */
export function localToUtc(
  dateStr: string,
  timeStr: string,
  tz: string,
): string | null {
  const parsed = dayjs.tz(`${dateStr} ${timeStr}`, tz);
  if (!parsed.isValid()) return null;
  return parsed.toISOString();
}

/**
 * Absolute difference in minutes between two ISO timestamps.
 */
export function utcDiffMinutes(a: string, b: string): number {
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return Infinity;
  return Math.abs(aMs - bMs) / 60_000;
}
