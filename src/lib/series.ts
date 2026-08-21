import type { SeriesConfig, SeriesId } from "@/types";

export const SERIES: SeriesConfig[] = [
  { id: "f1", label: "Formula 1", shortLabel: "F1", color: "#E10600", colorDark: "#FF1E1E", defaultOn: true },
  { id: "f2", label: "Formula 2", shortLabel: "F2", color: "#0057B8", colorDark: "#2D9CDB", defaultOn: true },
  { id: "f3", label: "Formula 3", shortLabel: "F3", color: "#FF6B00", colorDark: "#FF9838", defaultOn: true },
  { id: "f1_academy", label: "F1 Academy", shortLabel: "F1A", color: "#EC4899", colorDark: "#F472B6", defaultOn: false },
  { id: "motogp", label: "MotoGP", shortLabel: "MotoGP", color: "#009688", colorDark: "#14B8A6", defaultOn: true },
  { id: "moto2", label: "Moto2", shortLabel: "Moto2", color: "#22C55E", colorDark: "#4ADE80", defaultOn: false },
  { id: "moto3", label: "Moto3", shortLabel: "Moto3", color: "#84CC16", colorDark: "#A3E635", defaultOn: false },
  { id: "formula_e", label: "Formula E", shortLabel: "FE", color: "#06B6D4", colorDark: "#67E8F9", defaultOn: false },
  { id: "indycar", label: "IndyCar", shortLabel: "INDY", color: "#FFD400", colorDark: "#FDE047", defaultOn: false },
  { id: "wec", label: "WEC", shortLabel: "WEC", color: "#EF4444", colorDark: "#F87171", defaultOn: false },
  { id: "nascar", label: "NASCAR", shortLabel: "NCS", color: "#6366F1", colorDark: "#818CF8", defaultOn: false },
  { id: "dtm", label: "DTM", shortLabel: "DTM", color: "#6B7280", colorDark: "#9CA3AF", defaultOn: false },
  { id: "imsa", label: "IMSA", shortLabel: "IMSA", color: "#94A3B8", colorDark: "#CBD5E1", defaultOn: false },
];

export const SERIES_BY_ID: Record<SeriesId, SeriesConfig> = Object.fromEntries(
  SERIES.map((s) => [s.id, s]),
) as Record<SeriesId, SeriesConfig>;

export const DEFAULT_SELECTED: SeriesId[] = SERIES.filter((s) => s.defaultOn).map((s) => s.id);