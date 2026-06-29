import type { Session } from "@/types";

export interface LayoutInfo {
  column: number;
  columnCount: number;
}

interface ClusterGroup {
  sessions: Session[];
  startMs: number;
  endMs: number;
}

function clusterize(sessions: Session[]): ClusterGroup[] {
  const sorted = [...sessions].sort(
    (a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc) || Date.parse(b.endUtc) - Date.parse(a.endUtc),
  );
  const clusters: ClusterGroup[] = [];
  for (const s of sorted) {
    const sStart = Date.parse(s.startUtc);
    const sEnd = Date.parse(s.endUtc);
    const last = clusters[clusters.length - 1];
    if (last && sStart < last.endMs) {
      last.sessions.push(s);
      last.endMs = Math.max(last.endMs, sEnd);
      last.startMs = Math.min(last.startMs, sStart);
    } else {
      clusters.push({ sessions: [s], startMs: sStart, endMs: sEnd });
    }
  }
  return clusters;
}

export function computeLayout(sessions: Session[]): Map<string, LayoutInfo> {
  const map = new Map<string, LayoutInfo>();
  const clusters = clusterize(sessions);
  for (const cluster of clusters) {
    const sorted = [...cluster.sessions].sort(
      (a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc) || Date.parse(b.endUtc) - Date.parse(a.endUtc),
    );
    const colLastEnd: number[] = [];
    const colAssignments: Record<string, number> = {};
    for (const s of sorted) {
      const sStart = Date.parse(s.startUtc);
      const sEnd = Date.parse(s.endUtc);
      let placed = -1;
      for (let i = 0; i < colLastEnd.length; i++) {
        if (colLastEnd[i] <= sStart) {
          placed = i;
          break;
        }
      }
      if (placed === -1) {
        placed = colLastEnd.length;
        colLastEnd.push(sEnd);
      } else {
        colLastEnd[placed] = sEnd;
      }
      colAssignments[s.id] = placed;
    }
    const cols = colLastEnd.length;
    for (const s of sorted) {
      map.set(s.id, { column: colAssignments[s.id], columnCount: cols });
    }
  }
  return map;
}