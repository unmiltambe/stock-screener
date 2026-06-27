// Pure presentation logic (the red→yellow→green thresholds etc.). Lifts into
// packages/view-logic when mobile arrives (ADR-0002). Returns token utility
// classes so the palette stays swappable via the @theme tokens.

export function fmtPrice(v: number | null): string {
  return v == null ? "—" : `$${v.toFixed(2)}`;
}

export function fmtNum(v: number | null, digits = 1): string {
  return v == null ? "—" : v.toFixed(digits);
}

export function scoreColor(v: number | null): string {
  if (v == null) return "text-dim";
  return v >= 60 ? "text-pos" : v >= 40 ? "text-warn" : "text-neg";
}

export function signalColor(s: string | null): string {
  if (s === "Buy") return "text-pos";
  if (s === "Trim") return "text-neg";
  return "text-warn";
}
