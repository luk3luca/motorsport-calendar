export type SeriesId =
  | "f1"
  | "f2"
  | "f3"
  | "f1_academy"
  | "motogp"
  | "moto2"
  | "moto3"
  | "formula_e"
  | "indycar"
  | "wec"
  | "wrc"
  | "nascar"
  | "sbk"
  | "dtm"
  | "imsa";

export type SessionType =
  | "free_practice"
  | "practice"
  | "qualifying"
  | "sprint_qualifying"
  | "sprint"
  | "sprint_race"
  | "feature_race"
  | "race"
  | "warmup"
  | "test"
  | "other";

export interface SeriesConfig {
  id: SeriesId;
  label: string;
  color: string;
  colorDark: string;
  defaultOn: boolean;
}

export interface Session {
  id: string;
  series: SeriesId;
  leagueName: string;
  name: string;
  sessionType: SessionType;
  eventKey: string;
  round: number | null;
  season: string;
  startUtc: string;
  endUtc: string;
  durationMin: number;
  venue: string;
  country: string;
  countryFlagEmoji: string;
  city: string | null;
  mapUrl: string | null;
  isEstimatedStart: boolean;
  isEstimatedEnd: boolean;
}

export interface CalendarData {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  seriesIncluded: SeriesId[];
  sessions: Session[];
}