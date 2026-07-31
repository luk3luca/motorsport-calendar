"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <span
        aria-hidden
        className="inline-block h-7 min-w-[68px] rounded-md border border-[var(--border)] bg-[var(--panel)]"
      />
    );
  }
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="h-7 min-w-[68px] rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {isDark ? "☾ Dark" : "☀ Light"}
    </button>
  );
}
