"use client";

import { useEffect, useState } from "react";

/**
 * Block style variants for the calendar session blocks.
 * Rendered side-by-side (per-series assignment) so they can be compared live,
 * and selectable globally via the floating pill or ?blocks=<id> URL param.
 */
export const BLOCK_STYLES = ["accent", "tint", "topline", "solid"] as const;
export type BlockStyle = (typeof BLOCK_STYLES)[number];

export const BLOCK_STYLE_LABEL: Record<BlockStyle, string> = {
  accent: "Accent (current)",
  tint: "Tint fill",
  topline: "Top line",
  solid: "Solid header",
};

const STORAGE_KEY = "mc:blockStyle";

function normalize(v: string | null): BlockStyle | null {
  if (!v) return null;
  return (BLOCK_STYLES as readonly string[]).includes(v) ? (v as BlockStyle) : null;
}

/** Read initial style: URL ?blocks=… wins over localStorage, else default. */
export function readInitialBlockStyle(): BlockStyle {
  if (typeof window === "undefined") return "accent";
  const fromUrl = normalize(new URLSearchParams(window.location.search).get("blocks"));
  if (fromUrl) {
    window.localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return normalize(window.localStorage.getItem(STORAGE_KEY)) ?? "accent";
}

/** Small hook exposing [style, setStyle] persisted to localStorage + ?blocks= in URL. */
export function useBlockStyle(): [BlockStyle, (v: BlockStyle) => void] {
  const [style, setStyle] = useState<BlockStyle>("accent");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStyle(readInitialBlockStyle());
  }, []);
  const set = (v: BlockStyle) => {
    setStyle(v);
    window.localStorage.setItem(STORAGE_KEY, v);
    const url = new URL(window.location.href);
    url.searchParams.set("blocks", v);
    window.history.replaceState(null, "", url);
  };
  return [style, set];
}
