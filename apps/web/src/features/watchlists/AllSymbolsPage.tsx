import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTickerChart, useTickerScores } from "../../api/tickers";
import { useAllSymbols } from "../../api/watchlists";
import type { TickerRow } from "../../api/types";
import {
  fcfYieldColor,
  fmtMarketCap,
  fmtNum,
  fmtPct,
  fmtPctAbs,
  fmtPrice,
  pegColor,
  rangeColor,
  roeColor,
  rsiColor,
  scoreColor,
  signalColor,
  sma200Color,
  sma50Color,
} from "../../lib/format";

// ── Sort ──────────────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

const ACCESSORS: Record<string, (r: TickerRow) => number | string | null> = {
  ticker:    r => r.ticker,
  company:   r => r.name,
  price:     r => r.price,
  marketCap: r => r.metrics.marketCap,
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
  lists:     r => r.lists.length,
};

function sortRows(rows: TickerRow[], key: string | null, dir: SortDir): TickerRow[] {
  if (!key) return rows;
  const accessor = ACCESSORS[key];
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

function Th({
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
      {isActive && <span className="ml-0.5 text-[10px]">{sort?.dir === "asc" ? " ↑" : " ↓"}</span>}
    </th>
  );
}

function RangeBar({ pos }: { pos: number | null }) {
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

// ── Inline chart panel ────────────────────────────────────────────────────────

const CHART_C = { accent: "#6ab0f5", accentA: "#6ab0f520", warn: "#f39c12", pos: "#2ecc71", line: "#222b3a", dim: "#8a93a6" };
const PERIODS = ["1W", "1M", "3M", "6M", "1Y", "5Y", "10Y"] as const;
type Period = typeof PERIODS[number];
const TRADING_DAYS: Record<Period, number> = { "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252, "5Y": 252*5, "10Y": 252*10 };
const YEARS_TO_FETCH: Record<Period, number> = { "1W": 1, "1M": 1, "3M": 1, "6M": 1, "1Y": 1, "5Y": 5, "10Y": 10 };

function makeTickFmt(period: Period) {
  return (t: string) => {
    if (!/^\d{4}/.test(t)) return t;
    const d = new Date(t + "T00:00:00");
    if (period === "5Y" || period === "10Y") return d.toLocaleDateString("en-US", { year: "numeric" });
    if (period === "1Y") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
}

function PanelTooltip({ active, payload, label }: {
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

function ChartPanel({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("1Y");
  const { data: chartData, isLoading: chartLoading } = useTickerChart(ticker, YEARS_TO_FETCH[period]);
  const { data: row } = useTickerScores(ticker);
  const points = chartData ? chartData.points.slice(-TRADING_DAYS[period]) : [];
  const tickInterval = Math.max(1, Math.floor(points.length / 8));

  return (
    <div className="bg-panel border border-line rounded-xl mb-4 overflow-hidden">
      <div className="flex h-[280px]">
        <div className="w-52 shrink-0 border-r border-line flex flex-col justify-between p-4">
          <div>
            <div className="flex items-start justify-between gap-1 mb-1">
              <span className="font-mono font-semibold text-xl">{ticker}</span>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <Link to={`/tickers/${ticker}`} title="Full detail" className="text-dim hover:text-accent text-xs transition-colors">↗</Link>
                <button onClick={onClose} className="text-dim hover:text-ink transition-colors text-lg leading-none">×</button>
              </div>
            </div>
            {row && (
              <>
                <p className="text-dim text-xs mb-3">{row.name}</p>
                <div className="font-mono font-semibold text-2xl mb-2">{fmtPrice(row.price)}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded bg-line ${scoreColor(row.scores.fund)}`}>F {fmtNum(row.scores.fund, 0)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded bg-line ${scoreColor(row.scores.tech)}`}>T {fmtNum(row.scores.tech, 0)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded bg-line ${scoreColor(row.scores.combined)}`}>C {fmtNum(row.scores.combined, 0)}</span>
                  <span className={`text-xs font-semibold ${signalColor(row.signal)}`}>{row.signal ?? "—"}</span>
                </div>
              </>
            )}
          </div>
          {row && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {[
                { label: "RSI", value: fmtNum(row.metrics.rsi, 0), color: rsiColor(row.metrics.rsi) },
                { label: "vs 200d", value: fmtPct(row.metrics.vsSma200), color: sma200Color(row.metrics.vsSma200) },
                { label: "PEG", value: fmtNum(row.metrics.peg, 2), color: pegColor(row.metrics.peg) },
                { label: "FCF Yield", value: fmtPctAbs(row.metrics.fcfYield), color: fcfYieldColor(row.metrics.fcfYield) },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="text-dim text-[10px]">{label}</div>
                  <div className={`font-mono font-medium ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col min-w-0 px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-3 text-[10px] text-dim">
              <span style={{ color: CHART_C.accent }}>— Price</span>
              <span style={{ color: CHART_C.warn }}>-- SMA 50</span>
              <span style={{ color: CHART_C.pos }}>· · SMA 200</span>
            </div>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={["px-2 py-0.5 rounded text-xs transition-colors",
                    period === p ? "bg-accent/20 text-accent border border-accent/40" : "text-dim hover:text-ink border border-transparent"].join(" ")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {chartLoading && <div className="h-full flex items-center justify-center text-dim text-sm">Loading…</div>}
            {!chartLoading && points.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_C.line} vertical={false} />
                  <XAxis dataKey="t" tickFormatter={makeTickFmt(period)} interval={tickInterval}
                    tick={{ fill: CHART_C.dim, fontSize: 10 }} axisLine={{ stroke: CHART_C.line }} tickLine={false} />
                  <YAxis domain={[(min: number) => min * 0.98, (max: number) => max * 1.02]}
                    tickFormatter={(v) => `$${v.toFixed(0)}`} tick={{ fill: CHART_C.dim, fontSize: 10 }}
                    axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<PanelTooltip />} cursor={{ stroke: CHART_C.dim, strokeWidth: 1, strokeDasharray: "4 4" }} />
                  <Area type="monotone" dataKey="price" name="Price" stroke={CHART_C.accent}
                    strokeWidth={1.5} fill={CHART_C.accentA} dot={false} activeDot={{ r: 3, fill: CHART_C.accent }} />
                  <Line type="monotone" dataKey="sma50" name="SMA 50" stroke={CHART_C.warn}
                    strokeWidth={1} strokeDasharray="5 3" dot={false} activeDot={false} />
                  <Line type="monotone" dataKey="sma200" name="SMA 200" stroke={CHART_C.pos}
                    strokeWidth={1} strokeDasharray="2 4" dot={false} activeDot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Table row (read-only — no remove button) ──────────────────────────────────

function TickerTableRow({ r, isSelected, onClick }: {
  r: TickerRow;
  isSelected: boolean;
  onClick: () => void;
}) {
  const m = r.metrics;
  return (
    <tr
      onClick={onClick}
      className={[
        "border-b border-line/50 cursor-pointer transition-colors",
        isSelected ? "bg-accent/10" : "hover:bg-panel",
      ].join(" ")}
    >
      <td className="py-2 pr-3 font-medium font-mono whitespace-nowrap">
        <span className={isSelected ? "text-accent" : ""}>{r.ticker}</span>
      </td>
      <td className="pr-4 text-dim whitespace-nowrap">{(r.name ?? "").slice(0, 26)}</td>
      <td className="pr-4 text-right font-mono whitespace-nowrap">{fmtPrice(r.price)}</td>
      <td className="pr-4 text-right font-mono text-dim whitespace-nowrap">{fmtMarketCap(m.marketCap)}</td>
      {/* Fundamental */}
      <td className="pr-3 text-right font-mono text-dim whitespace-nowrap border-l border-line/40 pl-3">{fmtNum(m.pe, 1)}</td>
      <td className="pr-3 text-right font-mono text-dim whitespace-nowrap">{fmtNum(m.fwdPe, 1)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${pegColor(m.peg)}`}>{fmtNum(m.peg, 2)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${fcfYieldColor(m.fcfYield)}`}>{fmtPctAbs(m.fcfYield)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${roeColor(m.roe)}`}>{fmtPctAbs(m.roe)}</td>
      {/* Technical */}
      <td className={`pr-3 text-right font-mono whitespace-nowrap border-l border-line/40 pl-3 ${rsiColor(m.rsi)}`}>{fmtNum(m.rsi, 0)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${sma200Color(m.vsSma200)}`}>{fmtPct(m.vsSma200)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${sma50Color(m.vsSma50)}`}>{fmtPct(m.vsSma50)}</td>
      <td className="pr-4 whitespace-nowrap"><RangeBar pos={m.rangePos} /></td>
      {/* Scores */}
      <td className={`pr-3 text-right font-mono whitespace-nowrap border-l border-line/40 pl-3 ${scoreColor(r.scores.fund)}`}>{fmtNum(r.scores.fund, 0)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.tech)}`}>{fmtNum(r.scores.tech, 0)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.combined)}`}>{fmtNum(r.scores.combined, 0)}</td>
      <td className={`pr-3 font-medium whitespace-nowrap ${signalColor(r.signal)}`}>{r.signal ?? "—"}</td>
      {/* Watchlists column */}
      <td className="pr-2 whitespace-nowrap border-l border-line/40 pl-3">
        <div className="flex flex-wrap gap-1">
          {r.lists.map((l) => (
            <span key={l} className="text-[10px] text-dim bg-line px-1.5 py-0.5 rounded">{l}</span>
          ))}
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TIPS = {
  ticker:   "Stock ticker symbol.",
  company:  "Full company name.",
  price:    "Current market price.",
  mktCap:   "Market capitalisation.",
  pe:       "Trailing P/E.",
  fwdPe:    "Forward P/E — price vs next 12m expected earnings.",
  peg:      "P/E adjusted for growth. < 1 cheap · 1–2 fair · > 2 expensive.",
  fcfYield: "Free cash flow yield. > 8% strong · ~4% S&P avg · < 0% burning cash.",
  roe:      "Return on equity. < 10% weak · 15–25% solid · > 30% strong.",
  rsi:      "14-day RSI. < 30 oversold · 30–70 neutral · > 70 overbought.",
  sma200:   "% vs 200-day MA. 0–15% above = ideal zone.",
  sma50:    "% vs 50-day MA. Pullback toward SMA-50 while above SMA-200 = entry.",
  range:    "52-week range position. Sweet spot: 10–45%.",
  fund:     "Fundamental score (0–100). Inputs: ROE 35%, FCF Yield 35%, PEG 30%.",
  tech:     "Technical score (0–100). Inputs: RSI 30%, SMA-200 30%, 52W Range 30%, SMA-50 10%.",
  combined: "Combined score = Fund×70% + Tech×30%.",
  signal:   "Buy / Neutral / Trim derived from scores.",
  lists:    "Watchlists this ticker appears in.",
};

export default function AllSymbolsPage() {
  const { data, isLoading, total, listCount } = useAllSymbols();
  const [sortKey, setSortKey] = useState<string | null>("combined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sort = { key: sortKey, dir: sortDir };
  const rows = sortRows(data, sortKey, sortDir);
  const thProps = { sort, onSort: handleSort };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link to="/" className="text-accent text-sm">← watchlists</Link>
        <span className="text-dim text-sm">/</span>
        <span className="text-sm font-semibold">All Symbols</span>
        <span className="text-[10px] text-dim bg-line px-2 py-0.5 rounded">Built-in · Read-only</span>
        {!isLoading && (
          <span className="text-dim text-xs ml-auto">
            {total} symbols across {listCount} watchlists
          </span>
        )}
      </div>

      {isLoading && <p className="text-dim">Loading symbols…</p>}

      {!isLoading && data.length > 0 && (
        <>
          {selectedTicker && (
            <ChartPanel ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
          )}

          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                {/* Group header row */}
                <tr className="text-[10px] uppercase tracking-wider border-b border-line/40">
                  <th colSpan={4} className="pb-1" />
                  <th colSpan={5} className="pb-1 text-center border-l border-line/40 pl-3 pr-4" style={{ color: "#2ecc71" }}>
                    Fundamental Metrics
                  </th>
                  <th colSpan={4} className="pb-1 text-center border-l border-line/40 pl-3 pr-4" style={{ color: "#6ab0f5" }}>
                    Technical Metrics
                  </th>
                  <th colSpan={4} className="pb-1 text-center border-l border-line/40 pl-3" style={{ color: "#8a93a6" }}>
                    Scores
                  </th>
                  <th className="pb-1 border-l border-line/40 pl-3 text-dim">Lists</th>
                </tr>
                {/* Individual column headers */}
                <tr className="text-dim text-left border-b border-line text-xs">
                  <Th tip={TIPS.ticker}   sortK="ticker"    {...thProps} className="pr-3 pt-1">Ticker</Th>
                  <Th tip={TIPS.company}  sortK="company"   {...thProps} className="pr-4 pt-1">Company</Th>
                  <Th tip={TIPS.price}    sortK="price"     {...thProps} className="pr-4 pt-1 text-right">Price</Th>
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
                  <Th tip={TIPS.fund}     sortK="fund"      {...thProps} className="pr-3 pt-1 text-right border-l border-line/40 pl-3">Fund<br/>Score</Th>
                  <Th tip={TIPS.tech}     sortK="tech"      {...thProps} className="pr-3 pt-1 text-right">Tech<br/>Score</Th>
                  <Th tip={TIPS.combined} sortK="combined"  {...thProps} className="pr-4 pt-1 text-right">Combined<br/>Score</Th>
                  <Th tip={TIPS.signal}   sortK="signal"    {...thProps} className="pr-3 pt-1">Signal</Th>
                  <Th tip={TIPS.lists}    sortK="lists"     {...thProps} className="pl-3 pt-1 border-l border-line/40">Watchlists</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <TickerTableRow
                    key={r.ticker}
                    r={r}
                    isSelected={selectedTicker === r.ticker}
                    onClick={() => setSelectedTicker((p) => p === r.ticker ? null : r.ticker)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isLoading && data.length === 0 && (
        <p className="text-dim text-sm mt-8 text-center">
          No symbols yet — add tickers to your watchlists to see them here.
        </p>
      )}
    </div>
  );
}
