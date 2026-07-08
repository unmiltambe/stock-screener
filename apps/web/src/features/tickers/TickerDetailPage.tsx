import { useLocation, useParams } from "react-router-dom";
import { Breadcrumb, ChartPanel } from "../watchlists/TickerTable";
import { useTickerScores } from "../../api/tickers";
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

  const { data: row, isLoading } = useTickerScores(symbol);

  const backTo = fromId ? `/watchlists/${fromId}` : "/watchlists";
  const backLabel = fromName ?? "watchlists";

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <Breadcrumb crumbs={[{ label: backLabel, to: backTo }, { label: symbol, to: `/tickers/${symbol}` }]} />
      </div>

      {isLoading && <p className="text-dim">Loading…</p>}

      {row && (
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
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

      {/* Chart — full-width, no sidebar (page header already has the scores) */}
      <ChartPanel ticker={symbol} onClose={() => {}} hideSidebar />

      {/* Metrics grid */}
      {row && (
        <>
          <h2 className="text-xs text-dim uppercase tracking-wider mb-3 mt-6">Fundamental inputs</h2>
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
            <Metric label="In watchlists" value={row.lists.length > 0 ? row.lists.join(", ") : "—"} />
          </div>
        </>
      )}
    </div>
  );
}
