"use client";

import { useEffect, useMemo, useState } from "react";
import type { SeriesId } from "@/types";
import { getCalendar } from "@/lib/data";
import { SERIES } from "@/lib/series";
import {
  DEFAULT_OFFSET_MIN,
  weekStartIso,
  todayIso,
  setLocalTz,
  dayStartIso,
  dayEndIso,
} from "@/lib/timezone";
import { loadInitial, STORAGE_KEY } from "@/components/series-sidebar";
import SeriesSidebar from "@/components/series-sidebar";
import ThemeToggle from "@/components/theme-toggle";
import TimezonePicker, { TZ_STORAGE_KEY } from "@/components/timezone-picker";
import DateNav from "@/components/date-nav";
import DayView from "@/components/day-view";
import WeekView from "@/components/week-view";

const LOCAL_KEY = "mc:localActive";

export default function CalendarShell() {
  const calendar = useMemo(() => getCalendar(), []);
  const allSessions = calendar.sessions;
  const [offsetMin, setOffsetMin] = useState<number>(DEFAULT_OFFSET_MIN);
  const [selected, setSelected] = useState<SeriesId[]>(() => loadInitial());
  const [view, setView] = useState<"day" | "week">("week");
  const [cursor, setCursor] = useState<string>("2026-07-03");
  const [isolatedId, setIsolatedId] = useState<string | null>(null);
  // Default ON: first visit uses the browser's timezone. If the user picks a
  // fixed offset instead, the choice is stored and respected on later visits.
  const [localActive, setLocalActive] = useState<boolean>(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const storedTz = window.localStorage.getItem(TZ_STORAGE_KEY);
    if (storedTz) {
      const n = Number(storedTz);
      if (Number.isFinite(n)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOffsetMin(n);
      }
    }
    const storedLocal = window.localStorage.getItem(LOCAL_KEY);
    // Local timezone is the default; only an explicit "false" (user picked a
    // fixed offset) keeps it off.
    if (storedLocal !== "false") {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setLocalTz(detected);
      setLocalActive(true);
    }
    const t = todayIso(DEFAULT_OFFSET_MIN);
    if (t >= calendar.windowStart.slice(0, 10) && t <= calendar.windowEnd.slice(0, 10)) {
      setCursor(t);
    }
  }, [calendar]);

  // Persist series selection (same storage key/format as before)
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  }, [selected]);

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

  // Sessions per series in the currently visible period (week or day)
  const counts = useMemo(() => {
    const c = {} as Record<SeriesId, number>;
    for (const s of SERIES) c[s.id] = 0;
    const ranges: [number, number][] = [];
    if (view === "day") {
      ranges.push([
        Date.parse(dayStartIso(cursor, offsetMin)),
        Date.parse(dayEndIso(cursor, offsetMin)),
      ]);
    } else {
      const ws = weekStartIso(cursor);
      const baseMs = Date.parse(`${ws}T00:00:00Z`);
      for (let i = 0; i < 7; i++) {
        const iso = new Date(baseMs + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        ranges.push([
          Date.parse(dayStartIso(iso, offsetMin)),
          Date.parse(dayEndIso(iso, offsetMin)),
        ]);
      }
    }
    for (const s of allSessions) {
      const st = Date.parse(s.startUtc);
      const en = Date.parse(s.endUtc);
      if (ranges.some(([a, b]) => st <= b && en >= a)) c[s.series] += 1;
    }
    return c;
  }, [allSessions, view, cursor, offsetMin]);

  const sidebarProps = {
    selected,
    counts,
  };

  return (
    <div className="min-h-dvh">
      {/* Mobile drawer overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
      {/* Mobile drawer */}
      <aside
        inert={drawerOpen ? undefined : true}
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-[var(--border)] bg-[var(--panel)] shadow-2xl transition-transform duration-200 ease-out lg:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SeriesSidebar
          {...sidebarProps}
          onChange={setSelected}
          onClose={() => setDrawerOpen(false)}
        />
      </aside>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-[var(--border)] bg-[var(--panel)] lg:block">
        <SeriesSidebar {...sidebarProps} onChange={setSelected} />
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_85%,transparent)] backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:px-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open series menu"
              title="Series"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--panel)] text-sm leading-none text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] lg:hidden"
            >
              ☰
            </button>
            <h1 className="flex items-center gap-2 text-sm font-bold tracking-tight">
              <span className="checker-strip hidden h-3.5 w-3.5 rounded-[3px] sm:inline-block" aria-hidden />
              <span className="uppercase tracking-[0.08em]">
                Motorsport<span className="text-[var(--accent)]">Calendar</span>
              </span>
            </h1>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <DateNav view={view} cursor={cursor} offsetMin={offsetMin} onChange={setCursor} />
              <div className="flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
                <button
                  type="button"
                  onClick={() => setView("day")}
                  aria-pressed={view === "day"}
                  className={`h-7 px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    view === "day"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={() => setView("week")}
                  aria-pressed={view === "week"}
                  className={`h-7 px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    view === "week"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Week
                </button>
              </div>
              <TimezonePicker
                value={offsetMin}
                onChange={setOffsetMin}
                localActive={localActive}
                onToggleLocal={toggleLocal}
              />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="px-3 py-3 md:px-4 md:py-4">
          {selected.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                No series selected
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Open the series menu and enable at least one championship.
              </p>
            </div>
          ) : view === "day" ? (
            <DayView
              dayIso={cursor}
              offsetMin={offsetMin}
              sessions={filteredSessions}
              isolatedId={isolatedId}
              onSelectSession={(s) => setIsolatedId(s)}
              onClearSelection={() => setIsolatedId(null)}
            />
          ) : (
            <WeekView
              weekStartIso={weekStartIso(cursor)}
              offsetMin={offsetMin}
              sessions={filteredSessions}
              isolatedId={isolatedId}
              onSelectSession={(s) => setIsolatedId(s)}
              onClearSelection={() => setIsolatedId(null)}
            />
          )}
        </main>

        <footer className="border-t border-[var(--border)] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Data from TheSportsDB / FIA / MotoGP — end times and some start times are estimates
          </p>
        </footer>
      </div>
    </div>
  );
}
