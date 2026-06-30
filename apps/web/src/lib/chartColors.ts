// Single source of truth for Recharts colors. Recharts needs literal color
// strings (CSS var() in SVG attributes doesn't resolve), so we read the design
// tokens from index.css at runtime instead of duplicating hex. Change a
// --color-* token there and the charts re-skin with everything else.
import { useTheme } from "./theme";

function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Call inside a component (after mount the tokens are on :root). Fallbacks match
// the default (light) palette so charts never render colorless if a token is missing.
export function chartColors() {
  const accent = token("--color-accent", "#e56515");
  return {
    accent,
    accentA: accent + "20", // ~12% alpha for the price area fill
    warn: token("--color-warn", "#b7791f"),
    pos: token("--color-pos", "#1f9b6b"),
    line: token("--color-line", "#e2e1dd"),
    dim: token("--color-dim", "#6f7174"),
    panel: token("--color-panel", "#ffffff"),
    ink: token("--color-ink", "#232320"),
  };
}

// Hook form: subscribes to the theme so charts re-render (and re-read the tokens)
// when light/dark flips. Use this in components instead of chartColors().
export function useChartColors() {
  useTheme(); // re-render on theme change
  return chartColors();
}
