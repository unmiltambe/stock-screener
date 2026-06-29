// Pure presentation logic — formatting + color thresholds. Lifts into
// packages/view-logic when mobile arrives (ADR-0002). All colors return CSS
// token utility classes so the palette stays swappable via @theme tokens.
// Thresholds mirror the prototype (SPEC.md §6) and docs/ui-columns.md.

// ── Number formatting ──────────────────────────────────────────────────────

export function fmtPrice(v: number | null): string {
  return v == null ? "—" : `$${v.toFixed(2)}`;
}

export function fmtNum(v: number | null, digits = 1): string {
  return v == null ? "—" : v.toFixed(digits);
}

/** Signed percentage: +3.5% / -12.4% */
export function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

/** Unsigned percentage: 42.0% */
export function fmtPctAbs(v: number | null, digits = 1): string {
  return v == null ? "—" : `${v.toFixed(digits)}%`;
}

export function fmtMarketCap(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

// ── Score colors (0–100 scale) ─────────────────────────────────────────────

export function scoreColor(v: number | null): string {
  if (v == null) return "text-dim";
  return v >= 60 ? "text-pos" : v >= 40 ? "text-warn" : "text-neg";
}

export function signalColor(s: string | null): string {
  if (s === "Buy") return "text-pos";
  if (s === "Trim") return "text-neg";
  return "text-warn";
}

// ── Fundamental metric colors ──────────────────────────────────────────────
// Source: prototype SPEC.md §6.1, docs/ui-columns.md

export function pegColor(v: number | null): string {
  if (v == null) return "text-dim";
  // < 1: getting more growth than you're paying for
  // 1–2: fair  |  > 2: expensive relative to growth
  return v < 1 ? "text-pos" : v < 2 ? "text-warn" : "text-neg";
}

export function fcfYieldColor(v: number | null): string {
  if (v == null) return "text-dim";
  // > 8%: very strong  |  > 4%: good  |  > 0%: weak  |  < 0%: burning cash
  return v > 8 ? "text-pos" : v > 4 ? "text-pos" : v > 0 ? "text-warn" : "text-neg";
}

export function roeColor(v: number | null): string {
  if (v == null) return "text-dim";
  // > 30%: strong moat  |  > 15%: solid  |  ≤ 15%: weak
  return v > 30 ? "text-pos" : v > 15 ? "text-warn" : "text-neg";
}

// ── Technical metric colors ────────────────────────────────────────────────
// Source: prototype SPEC.md §6.2, docs/ui-columns.md

export function rsiColor(v: number | null): string {
  if (v == null) return "text-dim";
  // < 30: oversold (entry opportunity)  |  30–70: neutral  |  > 70: overbought
  return v < 30 ? "text-pos" : v > 70 ? "text-neg" : "text-dim";
}

export function sma200Color(v: number | null): string {
  if (v == null) return "text-dim";
  // 0–15% above: ideal entry zone (healthy uptrend, not stretched)
  // < 0%: downtrend  |  15–30%: getting extended  |  > 30%: stretched, avoid chasing
  if (v >= 0 && v < 15) return "text-pos";
  if (v >= 15 && v < 30) return "text-warn";
  return "text-neg";
}

export function sma50Color(v: number | null): string {
  if (v == null) return "text-dim";
  // Pulling back toward SMA-50 while above SMA-200 is often a good entry
  if (v >= -5 && v < 10) return "text-pos";
  if (v >= 10 && v < 20) return "text-warn";
  return "text-neg";
}

export function rangeColor(v: number | null): string {
  if (v == null) return "text-dim";
  // Sweet spot: 10–45% of the 52W range (lower half, not a falling knife)
  // < 10%: potential falling knife  |  > 75%: chasing the high
  if (v < 10) return "text-warn";
  if (v <= 45) return "text-pos";
  if (v <= 65) return "text-dim";
  return v <= 80 ? "text-warn" : "text-neg";
}
