"use client";

import { useEffect, useMemo, useState } from "react";
import type { SeriesId } from "@/types";
import { getAllSessions } from "@/lib/data";
import { DEFAULT_OFFSET_MIN, weekStartIso, todayIso, setLocalTz } from "@/lib/timezone";
import { loadInitial } from "@/components/series-toggle";
import SeriesToggle from "@/components/series-toggle";
import ThemeToggle from "@/components/theme-toggle";
import TimezonePicker from "@/components/timezone-picker";
import DateNav from "@/components/date-nav";
import DayView from "@/components/day-view";
import WeekView from "@/components/week-view";

const TZ_KEY = "mc:offsetMin";
const LOCAL_KEY = "mc:localActive";

export default function CalendarShell() {
  const allSessions = useMemo(() => getAllSessions(), []);
  const [offsetMin, setOffsetMin] = useState<number>(DEFAULT_OFFSET_MIN);
  const [selected, setSelected] = useState<SeriesId[]>(() => loadInitial());
  const [view, setView] = useState<"day" | "week">("week");
  const [cursor, setCursor] = useState<string>(() => {
    if (typeof window === "undefined") return "2026-07-03";
    return "2026-07-03";
  });
  const [isolatedId, setIsolatedId] = useState<string | null>(null);
  const [localActive, setLocalActive] = useState<boolean>(false);

  useEffect(() => {
    const storedTz = window.localStorage.getItem(TZ_KEY);
    if (storedTz) {
      const n = Number(storedTz);
      if (Number.isFinite(n)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOffsetMin(n);
      }
    }
    const storedLocal = window.localStorage.getItem(LOCAL_KEY);
    if (storedLocal === "true") {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setLocalTz(detected);
      setLocalActive(true);
    }
    const t = todayIso(DEFAULT_OFFSET_MIN);
    if (t >= "2026-07-03" && t <= "2026-07-08") {
      setCursor(t);
    }
  }, []);

  const toggleLocal = () => {
    const next = !localActive;
    if (next) {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setLocalTz(detected);
    } else {
      setLocalTz(null);
    }
    window.localStorage.setItem(LOCAL_KEY, next ? "true" : "false");
    setLocalActive(next);
  };

  const filteredSessions = useMemo(() => {
    const selectedSet = new Set(selected);
    return allSessions.filter((s) => selectedSet.has(s.series));
  }, [allSessions, selected]);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold">Motorsport Calendar</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DateNav view={view} cursor={cursor} offsetMin={offsetMin} onChange={setCursor} />
          <div className="flex overflow-hidden rounded border border-black/15 dark:border-white/20">
            <button
              type="button"
              onClick={() => setView("day")}
              className={`px-2 py-1 text-xs ${view === "day" ? "bg-black text-white dark:bg-white dark:text-black" : ""}`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setView("week")}
              className={`px-2 py-1 text-xs ${view === "week" ? "bg-black text-white dark:bg-white dark:text-black" : ""}`}
            >
              Week
            </button>
          </div>
          <SeriesToggle selected={selected} onChange={setSelected} />
          <TimezonePicker value={offsetMin} onChange={setOffsetMin} localActive={localActive} onToggleLocal={toggleLocal} />
          <ThemeToggle />
        </div>
      </header>

      {selected.length === 0 ? (
        <div className="rounded border border-dashed border-black/20 p-6 text-center text-sm opacity-60 dark:border-white/20">
          Select at least one series to see sessions.
        </div>
      ) : view === "day" ? (
        <DayView
          dayIso={cursor}
          offsetMin={offsetMin}
          sessions={filteredSessions}
          isolatedId={isolatedId}
          onSelectSession={(s, ek) => setIsolatedId(s + ":" + ek)}
          onClearSelection={() => setIsolatedId(null)}
        />
      ) : (
        <WeekView
          weekStartIso={weekStartIso(cursor)}
          offsetMin={offsetMin}
          sessions={filteredSessions}
          isolatedId={isolatedId}
          onSelectSession={(s, ek) => setIsolatedId(s + ":" + ek)}
          onClearSelection={() => setIsolatedId(null)}
        />
      )}

      <footer className="text-xs opacity-50">
        Data from TheSportsDB free API (V1). End times and some start times are estimates. UI is provisional.
      </footer>
    </div>
  );
}