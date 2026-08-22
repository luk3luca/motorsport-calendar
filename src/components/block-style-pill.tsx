"use client";

import { BLOCK_STYLES, BLOCK_STYLE_LABEL, useBlockStyle, type BlockStyle } from "./block-styles";

/**
 * Floating style-switcher (bottom-right) for the block-restyle experiment.
 * Cycles through the variants globally; ?blocks=<id> also works.
 */
export default function BlockStylePill() {
  const [style, setStyle] = useBlockStyle();

  const cycle = () => {
    const idx = BLOCK_STYLES.indexOf(style);
    setStyle(BLOCK_STYLES[(idx + 1) % BLOCK_STYLES.length]);
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-1">
      <div className="flex overflow-hidden rounded-full border border-[var(--border)] bg-[var(--panel)] shadow-lg">
        {BLOCK_STYLES.map((s: BlockStyle) => (
          <button
            key={s}
            type="button"
            onClick={() => setStyle(s)}
            title={BLOCK_STYLE_LABEL[s]}
            className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
              style === s
                ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={cycle}
        className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        cycle
      </button>
    </div>
  );
}
