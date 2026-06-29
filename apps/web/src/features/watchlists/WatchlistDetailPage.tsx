import { useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import {
  useAddTicker,
  useRemoveTicker,
  useWatchlist,
  useWatchlists,
} from "../../api/watchlists";
import { useTickerChart, useTickerScores } from "../../api/tickers";
import type { ChartPoint, TickerRow } from "../../api/types";
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

// ── Column header ─────────────────────────────────────────────────────────────

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
      {isActive && (
        <span className="ml-0.5 text-[10px]">{sort?.dir === "asc" ? " ↑" : " ↓"}</span>
      )}
    </th>
  );
}

// ── Range bar ─────────────────────────────────────────────────────────────────

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

// ── Tooltip text ──────────────────────────────────────────────────────────────

const TIPS = {
  ticker:   "Stock ticker symbol.",
  company:  "Full company name.",
  price:    "Current market price.",
  mktCap:   "Market capitalisation.\n\nLarger = more established.\nSmaller = more growth potential but higher risk.",
  pe:       "Trailing P/E — price vs last 12 months of actual earnings.\n\nFor reference only. Fwd P/E is more useful for growth companies.\n\n< 15 cheap  |  15–25 fair  |  > 25 expensive",
  fwdPe:    "Price vs next 12 months of expected earnings.\n\nMore useful than trailing P/E for growth companies.\n\n< 15 cheap  |  15–25 fair  |  > 25 expensive",
  peg:      "Adjusts P/E for growth — are you paying a fair price for the growth you're getting?\n\n< 1  getting more growth than you're paying for\n1–2  fair\n> 2  expensive relative to growth",
  fcfYield: "Free cash flow as % of market cap.\n\nHow much real cash the business generates vs what you're paying. Catches companies where earnings look good but cash conversion is weak.\n\n< 0%  burning cash\n~4%  S&P 500 average\n> 8%  very strong",
  roe:      "Return on equity — net income ÷ shareholders' equity.\n\nMeasures how efficiently management turns capital into profit. High ROE sustained over time signals a competitive moat.\n\n< 10%  weak\n15–25%  solid\n> 30%  strong moat",
  rsi:      "14-day momentum oscillator — has the stock been pushed too far in one direction?\n\n< 30  oversold — potential entry\n30–70  neutral\n> 70  overbought — stretched",
  sma200:   "Distance from the 200-day moving average — is the long-term trend healthy?\n\nPositive = above (uptrend)  |  Negative = below (downtrend)\n\n0–15% above is the ideal entry zone: confirmed uptrend, not yet stretched.",
  sma50:    "Distance from the 50-day moving average — short-term trend health.\n\nPulling back toward SMA-50 while above SMA-200 is often a good entry point.",
  range:    "Where the current price sits within its 52-week high/low range.\n\nLower in the range = potential discount entry.\nNear the top = be cautious chasing.\n\nSweet spot: 10–45% of range.",
  fund:     "Composite quality + valuation score (0–100). Higher = better.\n\n> 60  Undervalued\n35–60  Fair\n< 35  Overvalued\n\nInputs: ROE (35%), FCF Yield (35%), PEG (30%)\nNormalised via sigmoid — no hard caps.",
  tech:     "Composite momentum score (0–100). Higher = more bullish setup.\n\n> 60  Bullish\n40–60  Neutral\n< 40  Bearish\n\nInputs: RSI (30%), SMA-200 (30%), 52W range (30%), SMA-50 (10%)",
  combined: "Overall score combining valuation and momentum (0–100).\n\n= Fundamental × 70% + Technical × 30%\n\n≥ 65  strong buy candidate\n35–65  neutral\n< 35  avoid",
  signal:   "Action signal derived from Fundamental + Technical scores.\n\nBuy = undervalued with a constructive technical setup.\nTrim = overvalued — consider rotating out.\nNeutral = no strong conviction either way.",
};

// ── Inline chart panel ────────────────────────────────────────────────────────

const CHART_C = {
  accent:  "#6ab0f5",
  accentA: "#6ab0f520",
  warn:    "#f39c12",
  pos:     "#2ecc71",
  line:    "#222b3a",
  dim:     "#8a93a6",
};

const PERIODS = ["1W", "1M", "3M", "6M", "1Y"] as const;
type Period = typeof PERIODS[number];
const TRADING_DAYS: Record<Period, number> = { "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };

function filterPoints(points: ChartPoint[], period: Period) {
  return points.slice(-TRADING_DAYS[period]);
}

function makeTickFmt(period: Period) {
  return (t: string) => {
    if (!/^\d{4}/.test(t)) return t;
    const d = new Date(t + "T00:00:00");
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
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: ${p.value.toFixed(2)}
        </p>
      ) : null)}
    </div>
  );
}

function ChartPanel({ ticker, watchlistId, onClose }: {
  ticker: string;
  watchlistId: string;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<Period>("1Y");
  const { data: chartData, isLoading: chartLoading } = useTickerChart(ticker);
  const { data: row, isLoading: rowLoading } = useTickerScores(ticker);

  const points = chartData ? filterPoints(chartData.points, period) : [];
  const tickInterval = Math.max(1, Math.floor(points.length / 5));

  return (
    <div className="w-[400px] shrink-0 sticky top-6 self-start">
      <div className="bg-panel border border-line rounded-xl overflow-hidden">
        {/* Panel header */}
        <div className="flex items-start justify-between p-4 border-b border-line">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-lg">{ticker}</span>
              {row && (
                <span className={`text-sm font-semibold ${signalColor(row.signal)}`}>
                  {row.signal ?? "—"}
                </span>
              )}
            </div>
            {row && (
              <>
                <p className="text-dim text-xs mt-0.5 truncate">{row.name}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="font-mono font-medium">{fmtPrice(row.price)}</span>
                  <span className={`text-xs ${scoreColor(row.scores.fund)}`}>F {fmtNum(row.scores.fund, 0)}</span>
                  <span className={`text-xs ${scoreColor(row.scores.tech)}`}>T {fmtNum(row.scores.tech, 0)}</span>
                  <span className={`text-xs ${scoreColor(row.scores.combined)}`}>C {fmtNum(row.scores.combined, 0)}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <Link
              to={`/tickers/${ticker}`}
              state={{ from: watchlistId, fromName: row?.name }}
              title="Full detail page"
              className="text-dim hover:text-accent text-xs transition-colors"
            >
              ↗
            </Link>
            <button
              onClick={onClose}
              className="text-dim hover:text-ink transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Period toggle */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 text-[10px] text-dim">
            <span style={{ color: CHART_C.accent }}>— Price</span>
            <span style={{ color: CHART_C.warn }}>-- SMA 50</span>
            <span style={{ color: CHART_C.pos }}>· · SMA 200</span>
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
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="px-2 pb-3">
          {(chartLoading || rowLoading) && (
            <div className="h-48 flex items-center justify-center text-dim text-sm">Loading…</div>
          )}
          {!chartLoading && points.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_C.line} vertical={false} />
                <XAxis
                  dataKey="t"
                  tickFormatter={makeTickFmt(period)}
                  interval={tickInterval}
                  tick={{ fill: CHART_C.dim, fontSize: 10 }}
                  axisLine={{ stroke: CHART_C.line }}
                  tickLine={false}
                />
                <YAxis
                  domain={[(min: number) => min * 0.98, (max: number) => max * 1.02]}
                  tickFormatter={(v) => `$${v.toFixed(0)}`}
                  tick={{ fill: CHART_C.dim, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  content={<PanelTooltip />}
                  cursor={{ stroke: CHART_C.dim, strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area type="monotone" dataKey="price" name="Price" stroke={CHART_C.accent}
                  strokeWidth={1.5} fill={CHART_C.accentA} dot={false}
                  activeDot={{ r: 3, fill: CHART_C.accent }} />
                <Line type="monotone" dataKey="sma50" name="SMA 50" stroke={CHART_C.warn}
                  strokeWidth={1} strokeDasharray="5 3" dot={false} activeDot={false} />
                <Line type="monotone" dataKey="sma200" name="SMA 200" stroke={CHART_C.pos}
                  strokeWidth={1} strokeDasharray="2 4" dot={false} activeDot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Key metrics strip */}
        {row && (
          <div className="border-t border-line grid grid-cols-4 divide-x divide-line text-center">
            {[
              { label: "RSI", value: fmtNum(row.metrics.rsi, 0), color: rsiColor(row.metrics.rsi) },
              { label: "vs 200d", value: fmtPct(row.metrics.vsSma200), color: sma200Color(row.metrics.vsSma200) },
              { label: "PEG", value: fmtNum(row.metrics.peg, 2), color: pegColor(row.metrics.peg) },
              { label: "FCF Yld", value: fmtPctAbs(row.metrics.fcfYield), color: fcfYieldColor(row.metrics.fcfYield) },
            ].map(({ label, value, color }) => (
              <div key={label} className="py-2 px-1">
                <div className="text-dim text-[10px]">{label}</div>
                <div className={`font-mono text-xs font-medium ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function TickerTableRow({ r, isSelected, onClick, onRemove }: {
  r: TickerRow;
  isSelected: boolean;
  onClick: () => void;
  onRemove: (t: string) => void;
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
      <td className="pr-4 text-right font-mono text-dim whitespace-nowrap">{fmtMarketCap(m.marketCap)}</td>
      <td className="pr-3 text-right font-mono text-dim whitespace-nowrap">{fmtNum(m.pe, 1)}</td>
      <td className="pr-3 text-right font-mono text-dim whitespace-nowrap">{fmtNum(m.fwdPe, 1)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${pegColor(m.peg)}`}>{fmtNum(m.peg, 2)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${fcfYieldColor(m.fcfYield)}`}>{fmtPctAbs(m.fcfYield)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${roeColor(m.roe)}`}>{fmtPctAbs(m.roe)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${rsiColor(m.rsi)}`}>{fmtNum(m.rsi, 0)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${sma200Color(m.vsSma200)}`}>{fmtPct(m.vsSma200)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${sma50Color(m.vsSma50)}`}>{fmtPct(m.vsSma50)}</td>
      <td className="pr-4 whitespace-nowrap"><RangeBar pos={m.rangePos} /></td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.fund)}`}>{fmtNum(r.scores.fund, 0)}</td>
      <td className={`pr-3 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.tech)}`}>{fmtNum(r.scores.tech, 0)}</td>
      <td className={`pr-4 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.combined)}`}>{fmtNum(r.scores.combined, 0)}</td>
      <td className={`pr-3 font-medium whitespace-nowrap ${signalColor(r.signal)}`}>{r.signal ?? "—"}</td>
      <td className="pl-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onRemove(r.ticker)}
          title={`Remove ${r.ticker}`}
          className="opacity-0 group-hover:opacity-100 text-dim hover:text-neg transition-opacity text-lg leading-none"
        >×</button>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WatchlistDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useWatchlist(id);
  const { data: watchlists } = useWatchlists();
  const addTicker = useAddTicker(id);
  const removeTicker = useRemoveTicker(id);

  const [tickerInput, setTickerInput] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const watchlistName = watchlists?.find((w) => w.id === id)?.name ?? "Watchlist";

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function handleRowClick(ticker: string) {
    setSelectedTicker((prev) => prev === ticker ? null : ticker);
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const symbol = tickerInput.trim().toUpperCase();
    if (!symbol) return;
    addTicker.mutate(symbol, { onSuccess: () => setTickerInput("") });
  }

  if (isLoading) return <p className="text-dim">Loading…</p>;
  if (error) return <p className="text-neg">Failed to load: {String(error)}</p>;

  const sort = { key: sortKey, dir: sortDir };
  const rows = sortRows(data!, sortKey, sortDir);
  const thProps = { sort, onSort: handleSort };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/" className="text-accent">← watchlists</Link>
          <span className="text-dim">/</span>
          <span className="font-semibold">{watchlistName}</span>
        </div>
        <form onSubmit={submitAdd} className="flex gap-2">
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            placeholder="Add ticker…"
            maxLength={10}
            className="w-36 bg-bg border border-line rounded px-3 py-1.5 text-sm font-mono outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={addTicker.isPending || !tickerInput.trim()}
            className="text-sm px-3 py-1.5 rounded border border-line hover:border-accent text-accent transition-colors disabled:opacity-40"
          >
            {addTicker.isPending ? "Adding…" : "Add"}
          </button>
        </form>
      </div>

      {data!.length === 0 ? (
        <p className="text-dim text-sm mt-8 text-center">No tickers yet — add one above.</p>
      ) : (
        <div className="flex gap-4 items-start">
          {/* Table */}
          <div className="flex-1 min-w-0 overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-dim text-left border-b border-line text-xs">
                  <Th tip={TIPS.ticker}   sortK="ticker"    {...thProps} className="pr-3">Ticker</Th>
                  <Th tip={TIPS.company}  sortK="company"   {...thProps} className="pr-4">Company</Th>
                  <Th tip={TIPS.price}    sortK="price"     {...thProps} className="pr-4 text-right">Price</Th>
                  <Th tip={TIPS.mktCap}   sortK="marketCap" {...thProps} className="pr-4 text-right">Mkt Cap</Th>
                  <Th tip={TIPS.pe}       sortK="pe"        {...thProps} className="pr-3 text-right">P/E</Th>
                  <Th tip={TIPS.fwdPe}    sortK="fwdPe"     {...thProps} className="pr-3 text-right">Fwd P/E</Th>
                  <Th tip={TIPS.peg}      sortK="peg"       {...thProps} className="pr-3 text-right">PEG</Th>
                  <Th tip={TIPS.fcfYield} sortK="fcfYield"  {...thProps} className="pr-3 text-right">FCF<br/>Yield</Th>
                  <Th tip={TIPS.roe}      sortK="roe"       {...thProps} className="pr-4 text-right">ROE</Th>
                  <Th tip={TIPS.rsi}      sortK="rsi"       {...thProps} className="pr-3 text-right">RSI</Th>
                  <Th tip={TIPS.sma200}   sortK="vsSma200"  {...thProps} className="pr-3 text-right">vs<br/>200d</Th>
                  <Th tip={TIPS.sma50}    sortK="vsSma50"   {...thProps} className="pr-4 text-right">vs<br/>50d</Th>
                  <Th tip={TIPS.range}    sortK="rangePos"  {...thProps} className="pr-4">52W Range</Th>
                  <Th tip={TIPS.fund}     sortK="fund"      {...thProps} className="pr-3 text-right">Fundamental<br/>Score</Th>
                  <Th tip={TIPS.tech}     sortK="tech"      {...thProps} className="pr-3 text-right">Technical<br/>Score</Th>
                  <Th tip={TIPS.combined} sortK="combined"  {...thProps} className="pr-4 text-right">Combined<br/>Score</Th>
                  <Th tip={TIPS.signal}   sortK="signal"    {...thProps} className="pr-3">Signal</Th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <TickerTableRow
                    key={r.ticker}
                    r={r}
                    isSelected={selectedTicker === r.ticker}
                    onClick={() => handleRowClick(r.ticker)}
                    onRemove={(t) => removeTicker.mutate(t)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart panel */}
          {selectedTicker && (
            <ChartPanel
              ticker={selectedTicker}
              watchlistId={id}
              onClose={() => setSelectedTicker(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
