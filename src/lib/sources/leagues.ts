import type { SeriesId } from "@/types";

export interface LeagueMapping {
  series: SeriesId;
  leagueId: number;
  label: string;
}

export const LEAGUES: LeagueMapping[] = [
  { series: "f1", leagueId: 4370, label: "Formula 1" },
  { series: "f2", leagueId: 4486, label: "Formula 2" },
  { series: "f3", leagueId: 4487, label: "Formula 3" },
  { series: "f1_academy", leagueId: 5382, label: "F1 Academy" },
  { series: "motogp", leagueId: 4407, label: "MotoGP" },
  { series: "moto2", leagueId: 4436, label: "Moto2" },
  { series: "moto3", leagueId: 4437, label: "Moto3" },
  { series: "formula_e", leagueId: 4371, label: "Formula E" },
  { series: "indycar", leagueId: 4373, label: "IndyCar Series" },
  { series: "wec", leagueId: 4413, label: "WEC" },
  { series: "nascar", leagueId: 4393, label: "NASCAR Cup Series" },
  { series: "dtm", leagueId: 4438, label: "DTM" },
  { series: "imsa", leagueId: 4488, label: "IMSA SportsCar Championship" },
];

export const LEAGUE_BY_SERIES: Record<SeriesId, LeagueMapping> = Object.fromEntries(
  LEAGUES.map((l) => [l.series, l]),
) as Record<SeriesId, LeagueMapping>;