// Single source of truth for Recharts colors. Recharts needs literal color
// strings (CSS var() in SVG attributes doesn't resolve), so we read the design
// tokens from index.css at runtime instead of duplicating hex. Change a
// --color-* token there and the charts re-skin with everything else.
function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Call inside a component (after mount the tokens are on :root). Fallbacks match
// the current palette so charts never render colorless even if a token is missing.
export function chartColors() {
  const accent = token("--color-accent", "#6ab0f5");
  return {
    accent,
    accentA: accent + "20", // ~12% alpha for the price area fill
    warn: token("--color-warn", "#f39c12"),
    pos: token("--color-pos", "#2ecc71"),
    line: token("--color-line", "#222b3a"),
    dim: token("--color-dim", "#8a93a6"),
    panel: token("--color-panel", "#161d2b"),
    ink: token("--color-ink", "#e6e6e6"),
  };
}
