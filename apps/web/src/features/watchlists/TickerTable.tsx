// Shared ticker table components — single source of truth for the table used by
// both WatchlistDetailPage and AllSymbolsPage. Per-view variations (remove
// button, Watchlists column) are injected via extraCell / extraGroupHeader /
// extraHeader render-prop slots; callers own the page-level state and data.

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUp, ArrowDown, ArrowUpRight } from "lucide-react";
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useChartColors } from "../../lib/chartColors";
import { useTickerChart, useTickerScores } from "../../api/tickers";
import type { TickerRow } from "../../api/types";
import {
  dayChangeColor, fcfYieldColor, fmtMarketCap, fmtNum, fmtNumAdaptive, fmtPctAbsAdaptive,
  fmtPctAdaptive, fmtPrice, pegColor, rangeColor, roeColor, rsiColor,
  scoreColor, signalColor, sma200Color, sma50Color,
} from "../../lib/format";

// ── Breadcrumb ────────────────────────────────────────────────────────────────

// Breadcrumb renders inline (no margin) — callers wrap in a mb-4 div as needed.
export function Breadcrumb({ crumbs }: {
  crumbs: { label: string; to: string }[];
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {crumbs.slice(0, -1).map((c) => (
        <span key={c.to} className="contents">
          <Link to={c.to} className="text-accent inline-flex items-center gap-1">
            <ArrowLeft size={14} strokeWidth={1.75} /> {c.label}
          </Link>
          <span className="text-dim">/</span>
        </span>
      ))}
      <span className="font-semibold">{crumbs[crumbs.length - 1].label}</span>
    </div>
  );
}

// ── Sort ──────────────────────────────────────────────────────────────────────

export type SortDir = "asc" | "desc";

export const BASE_ACCESSORS: Record<string, (r: TickerRow) => number | string | null> = {
  ticker:      r => r.ticker,
  company:     r => r.name,
  price:       r => r.price,
  dayChangePct: r => r.dayChangePct,
  marketCap:   r => r.metrics.marketCap,
  pe:        r => r.metrics.pe,
  fwdPe:     r => r.metrics.fwdPe,
  peg:       r => r.metrics.peg,
  fcfYield:  r => r.metrics.fcfYield,
  roe:       r => r.metrics.roe,
  rsi:       r => r.metrics.rsi,
  vsSma200:  r => r.metrics.vsSma200,
  vsSma50:   r => r.metrics.vsSma50,
  rangePos:  r => r.metrics.rangePos,
  fund:      r => r.scores.fund,
  tech:      r => r.scores.tech,
  combined:  r => r.scores.combined,
  signal:    r => r.signal,
};

export function sortRows(
  rows: TickerRow[],
  accessors: Record<string, (r: TickerRow) => number | string | null>,
  key: string | null,
  dir: SortDir,
): TickerRow[] {
  if (!key) return rows;
  const accessor = accessors[key];
  if (!accessor) return rows;
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" && typeof bv === "string"
      ? av.localeCompare(bv)
      : (av as number) - (bv as number);
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

export const TIPS = {
  ticker:   "Stock ticker symbol.",
  company:  "Full company name.",
  price:    "Current market price.",
  dayChange: "Change since the previous close.\n\nDuring market hours this is today's move so far; outside hours it's the last completed session.",
  mktCap:   "Market capitalisation.\n\nLarger = more established.\nSmaller = more growth potential but higher risk.",
  pe:       "Trailing P/E — price vs last 12 months of actual earnings.\n\nFor reference only. Fwd P/E is more useful for growth companies.\n\n< 15 cheap  |  15–25 fair  |  > 25 expensive",
  fwdPe:    "Price vs next 12 months of expected earnings.\n\nMore useful than trailing P/E for growth companies.\n\n< 15 cheap  |  15–25 fair  |  > 25 expensive",
  peg:      "Is it cheap?\n\nAdjusts P/E for growth — are you paying a fair price for the growth you're getting?\n\n< 1  getting more growth than you're paying for\n1–2  fair\n> 2  expensive relative to growth",
  fcfYield: "Is it generating cash?\n\nFree cash flow as % of market cap. How much real cash the business generates vs what you're paying. Catches companies where earnings look good but cash conversion is weak.\n\n< 0%  burning cash\n~4%  S&P 500 average\n> 8%  very strong",
  roe:      "Return on equity — net income ÷ shareholders' equity.\n\nMeasures how efficiently management turns capital into profit. High ROE sustained over time signals a competitive moat.\n\n< 10%  weak\n15–25%  solid\n> 30%  strong moat",
  rsi:      "Is momentum healthy?\n\n14-day momentum oscillator — has the stock been pushed too far in one direction?\n\n< 30  oversold — potential entry\n30–70  neutral\n> 70  overbought — stretched",
  sma200:   "Is the trend intact?\n\nDistance from the 200-day moving average.\n\nPositive = above (uptrend)  |  Negative = below (downtrend)\n\n0–15% above is the ideal entry zone: confirmed uptrend, not yet stretched.",
  sma50:    "Distance from the 50-day moving average — short-term trend health.\n\nPulling back toward SMA-50 while above SMA-200 is often a good entry point.",
  range:    "Where the current price sits within its 52-week high/low range.\n\nLower in the range = potential discount entry.\nNear the top = be cautious chasing.\n\nSweet spot: 10–45% of range.",
  fund:     "Composite quality + valuation score (0–100). Higher = better.\n\n> 60  Undervalued\n35–60  Fair\n< 35  Overvalued\n\nInputs: ROE (35%), FCF Yield (35%), PEG (30%)\nNormalised via sigmoid — no hard caps.",
  tech:     "Composite momentum score (0–100). Higher = more bullish setup.\n\n> 60  Bullish\n40–60  Neutral\n< 40  Bearish\n\nInputs: RSI (30%), SMA-200 (30%), 52W range (30%), SMA-50 (10%)",
  combined: "Overall score combining valuation and momentum (0–100).\n\n= Fundamental × 70% + Technical × 30%\n\n≥ 65  strong buy candidate\n35–65  neutral\n< 35  avoid",
  signal:   "Action signal derived from Fundamental + Technical scores.\n\nBuy = undervalued with a constructive technical setup.\nTrim = overvalued — consider rotating out.\nNeutral = no strong conviction either way.",
  lists:    "Watchlists this ticker appears in.",
};

// ── Column header ─────────────────────────────────────────────────────────────

export function Th({
  children, tip, className = "", sortK, sort, onSort,
}: {
  children: React.ReactNode;
  tip: string;
  className?: string;
  sortK?: string;
  sort?: { key: string | null; dir: SortDir };
  onSort?: (key: string) => void;
}) {
  const isActive = sortK != null && sort?.key === sortK;
  return (
    <th
      title={tip}
      onClick={sortK != null ? () => onSort?.(sortK) : undefined}
      className={[
        "py-2 select-none transition-colors whitespace-nowrap",
        sortK ? "cursor-pointer hover:text-ink" : "cursor-help",
        isActive ? "text-accent" : "",
        className,
      ].join(" ")}
    >
      {children}
      {isActive && (sort?.dir === "asc"
        ? <ArrowUp className="inline ml-0.5" size={12} strokeWidth={2} />
        : <ArrowDown className="inline ml-0.5" size={12} strokeWidth={2} />)}
    </th>
  );
}

// ── Range bar ─────────────────────────────────────────────────────────────────

export function RangeBar({ pos }: { pos: number | null }) {
  if (pos == null) return <span className="text-dim">—</span>;
  const pct = Math.max(0, Math.min(100, pos));
  const barColor = pct < 10 ? "bg-warn" : pct <= 45 ? "bg-pos" : pct <= 65 ? "bg-dim" : pct <= 80 ? "bg-warn" : "bg-neg";
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="h-1 w-14 bg-line rounded-full overflow-hidden shrink-0">
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono ${rangeColor(pos)}`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Chart panel ───────────────────────────────────────────────────────────────

export const PERIODS = ["1W", "1M", "3M", "6M", "1Y", "5Y", "10Y"] as const;
export type Period = typeof PERIODS[number];

export const TRADING_DAYS: Record<Period, number> = {
  "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252, "5Y": 252 * 5, "10Y": 252 * 10,
};
export const YEARS_TO_FETCH: Record<Period, number> = {
  "1W": 1, "1M": 1, "3M": 1, "6M": 1, "1Y": 1, "5Y": 5, "10Y": 10,
};

export function makeTickFmt(period: Period) {
  return (t: string) => {
    if (!/^\d{4}/.test(t)) return t;
    const d = new Date(t + "T00:00:00");
    if (period === "5Y" || period === "10Y") return d.toLocaleDateString("en-US", { year: "numeric" });
    if (period === "1Y") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
}

export function PanelTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const fmtLabel = /^\d{4}/.test(label ?? "")
    ? new Date((label ?? "") + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : label;
  return (
    <div className="bg-panel border border-line rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-dim mb-1">{fmtLabel}</p>
      {payload.map((p) => p.value != null ? (
        <p key={p.name} style={{ color: p.color }} className="font-mono">{p.name}: ${p.value.toFixed(2)}</p>
      ) : null)}
    </div>
  );
}

function VerdictCard({ score, signal }: { score: number | null; signal: string | null }) {
  const cfg = signal === "Buy"
    ? { dot: "bg-pos", text: "text-pos", border: "border-pos/30", bg: "bg-pos/10", bar: "bg-pos" }
    : signal === "Trim"
    ? { dot: "bg-neg", text: "text-neg", border: "border-neg/30", bg: "bg-neg/10", bar: "bg-neg" }
    : { dot: "bg-warn", text: "text-warn", border: "border-warn/30", bg: "bg-warn/10", bar: "bg-warn" };
  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} px-2.5 py-1.5`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
          <span className={`text-xs font-semibold ${cfg.text}`}>{signal ?? "Neutral"}</span>
        </div>
        <span className={`text-xs font-mono font-medium ${cfg.text}`}>{fmtNum(score, 0)}</span>
      </div>
      <div className="h-1 bg-line/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${score ?? 0}%` }} />
      </div>
    </div>
  );
}

// Small toggle pill used in the chart header to show/hide individual series.
function IndicatorToggle({ label, active, color, onClick }: {
  label: string; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-2 py-0.5 rounded text-[10px] border transition-colors",
        active
          ? "border-current"
          : "border-transparent text-dim hover:text-ink",
      ].join(" ")}
      style={active ? { color, borderColor: color, backgroundColor: color + "20" } : undefined}
    >
      {label}
    </button>
  );
}

// watchlistId is optional — when provided the detail link carries routing state
// so the detail page can offer a "back" link to the originating watchlist.
export function ChartPanel({ ticker, watchlistId, onClose, hideClose, hideSidebar }: {
  ticker: string;
  watchlistId?: string;
  onClose: () => void;
  // Landing hero embeds this always-on (spec home-landing.md D2) — no row to
  // collapse back into, so the close affordance and sub-panel toggles are suppressed.
  hideClose?: boolean;
  // Detail page shows ticker info in its own page header — sidebar is redundant there.
  hideSidebar?: boolean;
}) {
  const CHART_C = useChartColors();
  const [period, setPeriod] = useState<Period>("1Y");
  const [showSma50, setShowSma50] = useState(true);
  const [showSma200, setShowSma200] = useState(true);
  const [showMacd, setShowMacd] = useState(false);
  const [showObv, setShowObv] = useState(false);

  const { data: chartData, isLoading: chartLoading } = useTickerChart(ticker, YEARS_TO_FETCH[period]);
  const { data: row } = useTickerScores(ticker);
  const points = chartData ? chartData.points.slice(-TRADING_DAYS[period]) : [];
  const tickInterval = Math.max(1, Math.floor(points.length / 8));

  const hasObv = points.some((p) => p.obv != null);
  const hasMacd = points.some((p) => p.macd != null);

  // Price panel shrinks when sub-panels are open to keep overall height bounded.
  const subPanels = (showMacd ? 1 : 0) + (showObv ? 1 : 0);
  const priceH = subPanels === 0 ? "100%" : subPanels === 1 ? "55%" : "40%";
  const subH = subPanels === 2 ? "28%" : "38%";

  const sharedXAxis = (hide?: boolean) => (
    <XAxis
      dataKey="t"
      tickFormatter={hide ? () => "" : makeTickFmt(period)}
      interval={tickInterval}
      tick={hide ? false : { fill: CHART_C.dim, fontSize: 10 }}
      axisLine={{ stroke: CHART_C.line }}
      tickLine={false}
      height={hide ? 4 : undefined}
    />
  );

  return (
    <div className="bg-panel border border-line rounded-xl mb-4 overflow-hidden">
      <div className="flex" style={{ minHeight: 364 }}>
        {/* ── Sidebar ── */}
        {!hideSidebar && (
        <div className="w-52 shrink-0 border-r border-line flex flex-col justify-between p-4">
          <div>
            <div className="flex items-start justify-between gap-1 mb-1">
              <span className="font-mono font-semibold text-xl leading-tight">{ticker}</span>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <Link
                  to={`/tickers/${ticker}`}
                  {...(watchlistId ? { state: { from: watchlistId } } : {})}
                  title="Full detail page"
                  className="text-dim hover:text-accent transition-colors"
                ><ArrowUpRight size={15} strokeWidth={1.75} /></Link>
                {!hideClose && (
                  <button onClick={onClose} className="text-dim hover:text-ink transition-colors text-lg leading-none">×</button>
                )}
              </div>
            </div>
            {row && (
              <>
                <p className="text-dim text-xs leading-snug mb-2">{row.name}</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-mono font-semibold text-2xl">{fmtPrice(row.price)}</span>
                  <span className={`font-mono text-sm font-medium ${dayChangeColor(row.dayChangePct)}`}>{fmtPctAdaptive(row.dayChangePct)}</span>
                </div>
                <div className="space-y-1 mb-2">
                  {([
                    { label: "Fundamental", v: row.scores.fund },
                    { label: "Technical",   v: row.scores.tech },
                  ] as const).map(({ label, v }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[10px] text-dim w-[72px] shrink-0">{label}</span>
                      <div className="flex-1 h-1 bg-line rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreColor(v).replace("text-", "bg-")}`}
                          style={{ width: `${v ?? 0}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono font-medium w-6 text-right shrink-0 ${scoreColor(v)}`}>
                        {fmtNum(v, 0)}
                      </span>
                    </div>
                  ))}
                </div>
                <VerdictCard score={row.scores.combined} signal={row.signal} />
              </>
            )}
          </div>
          {row && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs pt-2 border-t border-line/40">
              {[
                { label: "PEG",       value: fmtNumAdaptive(row.metrics.peg, 2),      color: pegColor(row.metrics.peg),           tip: TIPS.peg },
                { label: "FCF Yield", value: fmtPctAbsAdaptive(row.metrics.fcfYield), color: fcfYieldColor(row.metrics.fcfYield), tip: TIPS.fcfYield },
                { label: "RSI",       value: fmtNum(row.metrics.rsi, 0),              color: rsiColor(row.metrics.rsi),           tip: TIPS.rsi },
                { label: "vs 200d",   value: fmtPctAdaptive(row.metrics.vsSma200),    color: sma200Color(row.metrics.vsSma200),   tip: TIPS.sma200 },
              ].map(({ label, value, color, tip }) => (
                <div key={label} title={tip} className="cursor-help">
                  <div className="text-dim text-[10px]">{label}</div>
                  <div className={`font-mono font-medium ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* ── Chart area ── */}
        <div className="flex-1 flex flex-col min-w-0 px-3 pt-3 pb-2">
          {/* Header: legend + period + indicator toggles */}
          <div className="flex items-center justify-between mb-2 shrink-0 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] mr-1" style={{ color: CHART_C.accent }}>— Price</span>
              {/* hideClose = landing hero: show static legend only. Otherwise: full toggles */}
              {!hideClose ? (
                <>
                  <IndicatorToggle label="SMA 50"  active={showSma50}  color={CHART_C.warn} onClick={() => setShowSma50(v => !v)} />
                  <IndicatorToggle label="SMA 200" active={showSma200} color={CHART_C.pos}  onClick={() => setShowSma200(v => !v)} />
                  <IndicatorToggle label="MACD"    active={showMacd}   color={CHART_C.accent} onClick={() => setShowMacd(v => !v)} />
                  <IndicatorToggle label="OBV"     active={showObv}    color={CHART_C.dim}  onClick={() => setShowObv(v => !v)} />
                </>
              ) : (
                <>
                  <span className="text-[10px] text-dim">-- SMA 50</span>
                  <span className="text-[10px] text-dim">·· SMA 200</span>
                </>
              )}
            </div>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={[
                    "px-2 py-0.5 rounded text-xs transition-colors",
                    period === p
                      ? "bg-accent/20 text-accent border border-accent/40"
                      : "text-dim hover:text-ink border border-transparent",
                  ].join(" ")}
                >{p}</button>
              ))}
            </div>
          </div>

          {chartLoading && (
            <div className="flex-1 flex items-center justify-center text-dim text-sm">Loading…</div>
          )}

          {!chartLoading && points.length > 0 && (
            <div className="flex-1 flex flex-col min-h-0 gap-0">
              {/* Price + SMA chart */}
              <div style={{ height: priceH }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_C.line} vertical={false} />
                    {sharedXAxis(showMacd || showObv)}
                    <YAxis
                      domain={[(min: number) => min * 0.98, (max: number) => max * 1.02]}
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                      tick={{ fill: CHART_C.dim, fontSize: 10 }}
                      axisLine={false} tickLine={false} width={52}
                    />
                    <Tooltip
                      content={<PanelTooltip />}
                      cursor={{ stroke: CHART_C.dim, strokeWidth: 1, strokeDasharray: "4 4" }}
                    />
                    <Area type="monotone" dataKey="price" name="Price" stroke={CHART_C.accent}
                      strokeWidth={1.5} fill={CHART_C.accentA} dot={false}
                      activeDot={{ r: 3, fill: CHART_C.accent }} />
                    {(hideClose || showSma50) && (
                      <Line type="monotone" dataKey="sma50" name="SMA 50" stroke={CHART_C.warn}
                        strokeWidth={1} strokeDasharray="5 3" dot={false} activeDot={false} connectNulls />
                    )}
                    {(hideClose || showSma200) && (
                      <Line type="monotone" dataKey="sma200" name="SMA 200" stroke={CHART_C.pos}
                        strokeWidth={1} strokeDasharray="2 4" dot={false} activeDot={false} connectNulls />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* MACD sub-panel */}
              {showMacd && (
                <div style={{ height: subH }} className="border-t border-line/40">
                  <div className="text-[9px] text-dim px-1 pt-0.5 leading-none">MACD (12,26,9)</div>
                  {!hasMacd ? (
                    <div className="flex items-center justify-center h-[80%] text-dim text-xs">Not enough data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="85%">
                      <ComposedChart data={points} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_C.line} vertical={false} />
                        {sharedXAxis(!showObv)}
                        <YAxis
                          tickFormatter={(v) => v.toFixed(1)}
                          tick={{ fill: CHART_C.dim, fontSize: 9 }}
                          axisLine={false} tickLine={false} width={40}
                        />
                        <Tooltip
                          content={<MacdTooltip />}
                          cursor={{ stroke: CHART_C.dim, strokeWidth: 1, strokeDasharray: "4 4" }}
                        />
                        <ReferenceLine y={0} stroke={CHART_C.line} strokeWidth={1} />
                        <Bar dataKey="macd_hist" name="Histogram" fill={CHART_C.accent}
                          opacity={0.5} isAnimationActive={false}
                          // color each bar by sign: positive = pos, negative = neg
                          label={false}
                        />
                        <Line type="monotone" dataKey="macd" name="MACD" stroke={CHART_C.accent}
                          strokeWidth={1.5} dot={false} activeDot={false} connectNulls />
                        <Line type="monotone" dataKey="macd_signal" name="Signal" stroke={CHART_C.warn}
                          strokeWidth={1} strokeDasharray="4 2" dot={false} activeDot={false} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {/* OBV sub-panel */}
              {showObv && (
                <div style={{ height: subH }} className="border-t border-line/40">
                  <div className="text-[9px] text-dim px-1 pt-0.5 leading-none">OBV</div>
                  {!hasObv ? (
                    <div className="flex items-center justify-center h-[80%] text-dim text-xs">No volume data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="85%">
                      <ComposedChart data={points} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_C.line} vertical={false} />
                        {sharedXAxis()}
                        <YAxis
                          tickFormatter={(v) => {
                            const abs = Math.abs(v);
                            if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                            if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                            return v.toFixed(0);
                          }}
                          tick={{ fill: CHART_C.dim, fontSize: 9 }}
                          axisLine={false} tickLine={false} width={40}
                        />
                        <Tooltip
                          content={<ObvTooltip />}
                          cursor={{ stroke: CHART_C.dim, strokeWidth: 1, strokeDasharray: "4 4" }}
                        />
                        <ReferenceLine y={0} stroke={CHART_C.line} strokeWidth={1} />
                        <Area type="monotone" dataKey="obv" name="OBV" stroke={CHART_C.dim}
                          strokeWidth={1.5} fill={CHART_C.dim + "15"} dot={false}
                          activeDot={{ r: 2, fill: CHART_C.dim }} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MacdTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const fmtLabel = /^\d{4}/.test(label ?? "")
    ? new Date((label ?? "") + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : label;
  return (
    <div className="bg-panel border border-line rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-dim mb-1">{fmtLabel}</p>
      {payload.map((p) => p.value != null ? (
        <p key={p.name} style={{ color: p.color }} className="font-mono">{p.name}: {p.value.toFixed(3)}</p>
      ) : null)}
    </div>
  );
}

function ObvTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const fmtLabel = /^\d{4}/.test(label ?? "")
    ? new Date((label ?? "") + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : label;
  const val = payload[0]?.value;
  const fmtObv = val == null ? "—"
    : Math.abs(val) >= 1e9 ? `${(val / 1e9).toFixed(2)}B`
    : Math.abs(val) >= 1e6 ? `${(val / 1e6).toFixed(2)}M`
    : val.toLocaleString();
  return (
    <div className="bg-panel border border-line rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-dim mb-1">{fmtLabel}</p>
      <p className="font-mono" style={{ color: payload[0]?.color }}>OBV: {fmtObv}</p>
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

// extraCell — caller injects the last <td> (e.g. remove button or watchlist
// tags). The <tr> always carries the "group" class so hover-based children work
// regardless of which variant is rendered.
export function TickerTableRow({ r, isSelected, onClick, extraCell }: {
  r: TickerRow;
  isSelected: boolean;
  onClick: () => void;
  extraCell?: React.ReactNode;
}) {
  const m = r.metrics;
  return (
    <tr
      onClick={onClick}
      className={[
        "group border-b border-line/50 cursor-pointer transition-colors",
        isSelected ? "bg-accent/10" : "hover:bg-panel",
      ].join(" ")}
    >
      <td className="py-2 pr-3 font-medium font-mono whitespace-nowrap">
        <span className={isSelected ? "text-accent" : ""}>{r.ticker}</span>
      </td>
      <td className="pr-4 text-dim whitespace-nowrap">{(r.name ?? "").slice(0, 26)}</td>
      <td className="pr-4 text-right font-mono whitespace-nowrap">{fmtPrice(r.price)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${dayChangeColor(r.dayChangePct)}`}>{fmtPctAdaptive(r.dayChangePct)}</td>
      <td className="pr-4 text-right font-mono text-dim whitespace-nowrap">{fmtMarketCap(m.marketCap)}</td>
      <td className="pr-3 text-right font-mono text-dim whitespace-nowrap border-l border-line/40 pl-3">{fmtNumAdaptive(m.pe, 1)}</td>
      <td className="pr-3 text-right font-mono text-dim whitespace-nowrap">{fmtNumAdaptive(m.fwdPe, 1)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${pegColor(m.peg)}`}>{fmtNumAdaptive(m.peg, 2)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${fcfYieldColor(m.fcfYield)}`}>{fmtPctAbsAdaptive(m.fcfYield)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${roeColor(m.roe)}`}>{fmtPctAbsAdaptive(m.roe)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap border-l border-line/40 pl-3 ${rsiColor(m.rsi)}`}>{fmtNum(m.rsi, 0)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${sma200Color(m.vsSma200)}`}>{fmtPctAdaptive(m.vsSma200)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${sma50Color(m.vsSma50)}`}>{fmtPctAdaptive(m.vsSma50)}</td>
      <td className="pr-4 whitespace-nowrap"><RangeBar pos={m.rangePos} /></td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap border-l border-line/40 pl-3 ${scoreColor(r.scores.fund)}`}>{fmtNum(r.scores.fund, 0)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.tech)}`}>{fmtNum(r.scores.tech, 0)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.combined)}`}>{fmtNum(r.scores.combined, 0)}</td>
      <td className={`pr-3 font-medium whitespace-nowrap ${signalColor(r.signal)}`}>{r.signal ?? "—"}</td>
      {extraCell}
    </tr>
  );
}

// ── Table head ────────────────────────────────────────────────────────────────

// extraGroupHeader — <th> injected into the group-label row (after Scores)
// extraHeader      — <th> injected into the column-label row (after Signal)
export function TickerTableHead({ sort, onSort, extraGroupHeader, extraHeader, className }: {
  sort: { key: string | null; dir: SortDir };
  onSort: (key: string) => void;
  extraGroupHeader?: React.ReactNode;
  extraHeader?: React.ReactNode;
  className?: string;
}) {
  const thProps = { sort, onSort };
  return (
    <thead className={className}>
      <tr className="text-[10px] uppercase tracking-wider border-b border-line/40">
        <th colSpan={5} className="pb-1" />
        <th colSpan={5} className="pb-1 text-center border-l border-line/40 pl-3 pr-4 text-warn">
          Fundamental Metrics
        </th>
        <th colSpan={4} className="pb-1 text-center border-l border-line/40 pl-3 pr-4 text-warn">
          Technical Metrics
        </th>
        <th colSpan={4} className="pb-1 text-center border-l border-line/40 pl-3 text-warn">
          Scores
        </th>
        {extraGroupHeader}
      </tr>
      <tr className="text-dim text-left border-b border-line text-xs">
        <Th tip={TIPS.ticker}   sortK="ticker"    {...thProps} className="pr-3 pt-1">Ticker</Th>
        <Th tip={TIPS.company}  sortK="company"   {...thProps} className="pr-4 pt-1">Company</Th>
        <Th tip={TIPS.price}    sortK="price"     {...thProps} className="pr-4 pt-1 text-right">Price</Th>
        <Th tip={TIPS.dayChange} sortK="dayChangePct" {...thProps} className="pr-4 pt-1 text-right">Chg %</Th>
        <Th tip={TIPS.mktCap}   sortK="marketCap" {...thProps} className="pr-4 pt-1 text-right">Mkt Cap</Th>
        <Th tip={TIPS.pe}       sortK="pe"        {...thProps} className="pr-3 pt-1 text-right border-l border-line/40 pl-3">P/E</Th>
        <Th tip={TIPS.fwdPe}    sortK="fwdPe"     {...thProps} className="pr-3 pt-1 text-right">Fwd P/E</Th>
        <Th tip={TIPS.peg}      sortK="peg"       {...thProps} className="pr-3 pt-1 text-right">PEG</Th>
        <Th tip={TIPS.fcfYield} sortK="fcfYield"  {...thProps} className="pr-3 pt-1 text-right">FCF<br/>Yield</Th>
        <Th tip={TIPS.roe}      sortK="roe"       {...thProps} className="pr-4 pt-1 text-right">ROE</Th>
        <Th tip={TIPS.rsi}      sortK="rsi"       {...thProps} className="pr-3 pt-1 text-right border-l border-line/40 pl-3">RSI</Th>
        <Th tip={TIPS.sma200}   sortK="vsSma200"  {...thProps} className="pr-3 pt-1 text-right">vs<br/>200d</Th>
        <Th tip={TIPS.sma50}    sortK="vsSma50"   {...thProps} className="pr-4 pt-1 text-right">vs<br/>50d</Th>
        <Th tip={TIPS.range}    sortK="rangePos"  {...thProps} className="pr-4 pt-1">52W Range</Th>
        <Th tip={TIPS.fund}     sortK="fund"      {...thProps} className="pr-3 pt-1 text-right border-l border-line/40 pl-3">Fundamental</Th>
        <Th tip={TIPS.tech}     sortK="tech"      {...thProps} className="pr-3 pt-1 text-right">Technical</Th>
        <Th tip={TIPS.combined} sortK="combined"  {...thProps} className="pr-4 pt-1 text-right">Overall</Th>
        <Th tip={TIPS.signal}   sortK="signal"    {...thProps} className="pr-3 pt-1">Signal</Th>
        {extraHeader}
      </tr>
    </thead>
  );
}
