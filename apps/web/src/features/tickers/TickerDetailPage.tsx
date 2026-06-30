import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
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
import type { ChartPoint } from "../../api/types";
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

// ── Design token hex values (Recharts can't read CSS variables) ───────────────
const C = {
  accent:  "#6ab0f5",
  accentA: "#6ab0f520",
  warn:    "#f39c12",
  pos:     "#2ecc71",
  line:    "#222b3a",
  dim:     "#8a93a6",
  ink:     "#e6e6e6",
  panel:   "#161d2b",
};

// ── Timeframe filtering ───────────────────────────────────────────────────────
const PERIODS = ["1W", "1M", "3M", "6M", "1Y", "5Y", "10Y"] as const;
type Period = typeof PERIODS[number];

const TRADING_DAYS: Record<Period, number> = {
  "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252, "5Y": 252 * 5, "10Y": 252 * 10,
};
const YEARS_TO_FETCH: Record<Period, number> = {
  "1W": 1, "1M": 1, "3M": 1, "6M": 1, "1Y": 1, "5Y": 5, "10Y": 10,
};

function filterPoints(points: ChartPoint[], period: Period): ChartPoint[] {
  return points.slice(-TRADING_DAYS[period]);
}

function makeTickFormatter(period: Period) {
  return (t: string): string => {
    if (!/^\d{4}/.test(t)) return t;
    const d = new Date(t + "T00:00:00");
    if (period === "5Y" || period === "10Y")
      return d.toLocaleDateString("en-US", { year: "numeric" });
    if (period === "1Y")
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const fmtLabel = (/^\d{4}/.test(label ?? ""))
    ? new Date((label ?? "") + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : label;
  return (
    <div className="bg-panel border border-line rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-dim mb-1.5">{fmtLabel}</p>
      {payload.map((p) =>
        p.value != null ? (
          <p key={p.name} style={{ color: p.color }} className="font-mono">
            {p.name}: ${p.value.toFixed(2)}
          </p>
        ) : null
      )}
    </div>
  );
}

// ── Metric tile ───────────────────────────────────────────────────────────────
function Metric({ label, value, color = "" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-panel border border-line rounded-lg px-4 py-3">
      <div className="text-dim text-xs mb-1">{label}</div>
      <div className={`font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TickerDetailPage() {
  const { symbol = "" } = useParams();
  const location = useLocation();
  const fromId: string | undefined = location.state?.from;
  const fromName: string | undefined = location.state?.fromName;

  const [period, setPeriod] = useState<Period>("1Y");
  const { data: chartData, isLoading: chartLoading, error: chartError } = useTickerChart(symbol, YEARS_TO_FETCH[period]);
  const { data: row, isLoading: rowLoading } = useTickerScores(symbol);

  const points = chartData ? filterPoints(chartData.points, period) : [];
  const tickInterval = Math.max(1, Math.floor(points.length / 6));
  const tickFormatter = makeTickFormatter(period);

  const isLoading = chartLoading || rowLoading;

  // Back breadcrumb — goes to the watchlist the user came from, or watchlists index
  const backTo = fromId ? `/watchlists/${fromId}` : "/";
  const backLabel = fromName ?? "watchlists";

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link to={backTo} className="text-accent">← {backLabel}</Link>
        <span className="text-dim">/</span>
        <span className="font-semibold font-mono">{symbol}</span>
      </div>

      {isLoading && <p className="text-dim">Loading…</p>}
      {chartError && <p className="text-neg">Failed to load chart data.</p>}

      {row && (
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold font-mono">{symbol}</h1>
            <p className="text-dim mt-0.5">{row.name}</p>
            {row.metrics.sector && <p className="text-dim text-xs mt-0.5">{row.metrics.sector}</p>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-semibold">{fmtPrice(row.price)}</div>
            <div className="flex items-center gap-3 mt-1 justify-end">
              <span className={`text-sm font-medium ${scoreColor(row.scores.fund)}`}>
                Fund {fmtNum(row.scores.fund, 0)}
              </span>
              <span className={`text-sm font-medium ${scoreColor(row.scores.tech)}`}>
                Tech {fmtNum(row.scores.tech, 0)}
              </span>
              <span className={`text-sm font-medium ${scoreColor(row.scores.combined)}`}>
                Combined {fmtNum(row.scores.combined, 0)}
              </span>
              <span className={`text-sm font-semibold ${signalColor(row.signal)}`}>
                {row.signal ?? "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData && points.length > 0 && (
        <div className="bg-panel border border-line rounded-xl p-4 mb-6">
          {/* Period toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-xs text-dim">
              <span style={{ color: C.accent }}>— Price</span>
              <span style={{ color: C.warn }}>-- SMA 50</span>
              <span style={{ color: C.pos }}>· · SMA 200</span>
            </div>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={[
                    "px-2.5 py-1 rounded text-xs transition-colors",
                    period === p
                      ? "bg-accent/20 text-accent border border-accent/40"
                      : "text-dim hover:text-ink border border-transparent hover:border-line",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={points} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={tickFormatter}
                interval={tickInterval}
                tick={{ fill: C.dim, fontSize: 11 }}
                axisLine={{ stroke: C.line }}
                tickLine={false}
              />
              <YAxis
                domain={[(min: number) => min * 0.98, (max: number) => max * 1.02]}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                tick={{ fill: C.dim, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: C.dim, strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Area
                type="monotone"
                dataKey="price"
                name="Price"
                stroke={C.accent}
                strokeWidth={1.5}
                fill={C.accentA}
                dot={false}
                activeDot={{ r: 3, fill: C.accent }}
              />
              <Line
                type="monotone"
                dataKey="sma50"
                name="SMA 50"
                stroke={C.warn}
                strokeWidth={1}
                strokeDasharray="6 3"
                dot={false}
                activeDot={false}
              />
              <Line
                type="monotone"
                dataKey="sma200"
                name="SMA 200"
                stroke={C.pos}
                strokeWidth={1}
                strokeDasharray="2 4"
                dot={false}
                activeDot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Metrics grid */}
      {row && (
        <>
          <h2 className="text-xs text-dim uppercase tracking-wider mb-3">Fundamental inputs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-6">
            <Metric label="P/E (trailing)" value={fmtNum(row.metrics.pe, 1)} />
            <Metric label="Fwd P/E" value={fmtNum(row.metrics.fwdPe, 1)} />
            <Metric label="PEG" value={fmtNum(row.metrics.peg, 2)} color={pegColor(row.metrics.peg)} />
            <Metric label="FCF Yield" value={fmtPctAbs(row.metrics.fcfYield)} color={fcfYieldColor(row.metrics.fcfYield)} />
            <Metric label="ROE" value={fmtPctAbs(row.metrics.roe)} color={roeColor(row.metrics.roe)} />
          </div>

          <h2 className="text-xs text-dim uppercase tracking-wider mb-3">Technical inputs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <Metric label="RSI (14d)" value={fmtNum(row.metrics.rsi, 0)} color={rsiColor(row.metrics.rsi)} />
            <Metric label="vs SMA-200" value={fmtPct(row.metrics.vsSma200)} color={sma200Color(row.metrics.vsSma200)} />
            <Metric label="vs SMA-50" value={fmtPct(row.metrics.vsSma50)} color={sma50Color(row.metrics.vsSma50)} />
            <Metric label="52W Range" value={fmtPctAbs(row.metrics.rangePos, 0)} color={rangeColor(row.metrics.rangePos)} />
          </div>

          <h2 className="text-xs text-dim uppercase tracking-wider mb-3">Context</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Metric label="Market Cap" value={fmtMarketCap(row.metrics.marketCap)} />
            <Metric label="Sector" value={row.metrics.sector ?? "—"} />
            <Metric
              label="In watchlists"
              value={row.lists.length > 0 ? row.lists.join(", ") : "—"}
            />
          </div>
        </>
      )}
    </div>
  );
}
