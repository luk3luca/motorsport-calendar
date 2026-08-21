/* Verifica funzionale dei 3 fix: venue-tz longest-match, daysWithSessionsInWeek con _localTz, getSessionsForWeek in viewer time */
import { venueTimezone } from "../src/lib/sources/venue-tz";
import { daysWithSessionsInWeek, setLocalTz, dayStartIso, dayEndIso } from "../src/lib/timezone";
import { getSessionsForWeek } from "../src/lib/data";

let fails = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else { fails++; console.log(`  ✗ ${name} ${detail}`); }
}

// 1. Longest-match: Road America deve essere Chicago (CT), non New York (ET)
console.log("1. venueTimezone longest-match:");
check("Road America → America/Chicago", venueTimezone("Road America") === "America/Chicago", `got ${venueTimezone("Road America")}`);
check("Road Atlanta → America/New_York", venueTimezone("Road Atlanta") === "America/New_York", `got ${venueTimezone("Road Atlanta")}`);
check("generic 'Road Course' → Europe/London", venueTimezone("Silverstone Road Course") === "Europe/London");
check("Interlagos → America/Sao_Paulo", venueTimezone("Interlagos Circuit") === "America/Sao_Paulo");

// 2. daysWithSessionsInWeek coerente con dayStartIso in modalità locale
console.log("2. daysWithSessionsInWeek local-tz coherence:");
const sessions = [
  // sessione 23:30→00:30 UTC di domenica 12 lug: in UTC+2 finisce lunedì 13
  { startUtc: "2026-07-12T23:30:00Z", endUtc: "2026-07-13T00:30:00Z" },
];
setLocalTz(null);
const fixedOffsetDays = daysWithSessionsInWeek("2026-07-13", sessions, 120);
check("fixed offset UTC+2: lun presente (spill nella settimana giusta)", fixedOffsetDays.includes("2026-07-13"), JSON.stringify(fixedOffsetDays));
const prevWeek = daysWithSessionsInWeek("2026-07-06", sessions, 120);
check("settimana precedente vuota (nessuna assegnazione errata)", !prevWeek.includes("2026-07-12"), JSON.stringify(prevWeek));
// In modalità locale (Europe/Rome = DST +2 a luglio) il risultato deve coincidere
setLocalTz("Europe/Rome");
const localDays = daysWithSessionsInWeek("2026-07-13", sessions, 0);
check("local tz mode: stesso risultato del fixed offset", JSON.stringify(localDays) === JSON.stringify(fixedOffsetDays), JSON.stringify(localDays));
const boundaryCheck = dayStartIso("2026-07-06", 0);
check("dayStartIso rispetta _localTz", boundaryCheck === "2026-07-05T22:00:00.000Z", `got ${boundaryCheck}`);
setLocalTz(null);

// 3. getSessionsForWeek finestra viewer-time
console.log("3. getSessionsForWeek viewer-time window:");
const weekSessions = getSessionsForWeek("2026-07-06");
check("settimana 6-12 lug restituisce sessioni", weekSessions.length > 0, `got ${weekSessions.length}`);
// ogni sessione restituita deve intersecare la finestra [lun 00:00 -1h, dom 24:00 +1h] viewer time
const startMs = Date.parse(dayStartIso("2026-07-06", 60)) - 3600_000;
const endMs = Date.parse(dayEndIso("2026-07-12", 60)) + 3600_000;
const allIntersect = weekSessions.every((s) => Date.parse(s.startUtc) <= endMs && Date.parse(s.endUtc) >= startMs);
check("tutte le sessioni intersecano la finestra estesa", allIntersect);

console.log(fails === 0 ? "\nALL CHECKS PASSED" : `\n${fails} CHECKS FAILED`);
process.exit(fails === 0 ? 0 : 1);
