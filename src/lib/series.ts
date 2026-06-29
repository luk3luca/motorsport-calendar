import type { SeriesConfig, SeriesId } from "@/types";

export const SERIES: SeriesConfig[] = [
  { id: "f1", label: "Formula 1", color: "#E10600", colorDark: "#FF1E1E", defaultOn: true },
  { id: "f2", label: "Formula 2", color: "#0066B2", colorDark: "#2D9CDB", defaultOn: true },
  { id: "f3", label: "Formula 3", color: "#2D2D2D", colorDark: "#6B6B6B", defaultOn: true },
  { id: "f1_academy", label: "F1 Academy", color: "#C2185B", colorDark: "#F06292", defaultOn: false },
  { id: "motogp", label: "MotoGP", color: "#D80000", colorDark: "#FF3333", defaultOn: true },
  { id: "moto2", label: "Moto2", color: "#4CAF50", colorDark: "#66BB6A", defaultOn: false },
  { id: "moto3", label: "Moto3", color: "#FF9800", colorDark: "#FFB74D", defaultOn: false },
  { id: "formula_e", label: "Formula E", color: "#00B2EB", colorDark: "#4DD0E1", defaultOn: false },
  { id: "indycar", label: "IndyCar", color: "#FFD400", colorDark: "#FFE066", defaultOn: false },
  { id: "wec", label: "WEC", color: "#E2032E", colorDark: "#FF5252", defaultOn: false },
  { id: "wrc", label: "WRC", color: "#7E57C2", colorDark: "#9575CD", defaultOn: false },
  { id: "nascar", label: "NASCAR", color: "#1976D2", colorDark: "#42A5F5", defaultOn: false },
  { id: "sbk", label: "SBK", color: "#EF6C00", colorDark: "#FF8A65", defaultOn: false },
  { id: "dtm", label: "DTM", color: "#5D4037", colorDark: "#8D6E63", defaultOn: false },
  { id: "imsa", label: "IMSA", color: "#455A64", colorDark: "#78909C", defaultOn: false },
];

export const SERIES_BY_ID: Record<SeriesId, SeriesConfig> = Object.fromEntries(
  SERIES.map((s) => [s.id, s]),
) as Record<SeriesId, SeriesConfig>;

export const DEFAULT_SELECTED: SeriesId[] = SERIES.filter((s) => s.defaultOn).map((s) => s.id);