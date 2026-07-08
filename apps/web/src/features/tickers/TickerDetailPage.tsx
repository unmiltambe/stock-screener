import { useLocation, useParams } from "react-router-dom";
import { Breadcrumb, ChartPanel, VerdictCard } from "../watchlists/TickerTable";
import { useTickerScores } from "../../api/tickers";
import {
  fcfYieldColor,
  fmtMarketCap,
  fmtNum,
  fmtPct,
  fmtPctAbs,
  fmtPctAdaptive,
  fmtPrice,
  pegColor,
  rangeColor,
  roeColor,
  rsiColor,
  scoreColor,
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
          {/* Left: ticker → name + sector → price + change */}
          <div>
            <h1 className="text-[26px] font-bold font-mono leading-none tracking-tight mb-1">{symbol}</h1>
            <p className="text-dim text-sm mb-2.5">
              {row.name}
              {row.metrics.sector && <><span className="mx-1.5 opacity-40">·</span>{row.metrics.sector}</>}
            </p>
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-semibold font-mono">{fmtPrice(row.price)}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                (row.dayChangePct ?? 0) >= 0
                  ? "bg-pos/10 text-pos"
                  : "bg-neg/10 text-neg"
              }`}>
                {fmtPctAdaptive(row.dayChangePct)} today
              </span>
            </div>
          </div>
          {/* Right: Overall verdict on top, then Fundamental / Technical bars */}
          <div className="flex flex-col items-end gap-2">
            <div className="w-44">
              <VerdictCard score={row.scores.combined} signal={row.signal} />
            </div>
            <div className="w-44 space-y-1">
              {([
                { label: "Fundamental", v: row.scores.fund },
                { label: "Technical",   v: row.scores.tech },
              ] as const).map(({ label, v }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-dim w-[72px] shrink-0 text-right">{label}</span>
                  <div className="flex-1 h-1 bg-line rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${scoreColor(v).replace("text-", "bg-")}`}
                      style={{ width: `${v ?? 0}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono font-medium w-6 shrink-0 ${scoreColor(v)}`}>
                    {fmtNum(v, 0)}
                  </span>
                </div>
              ))}
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
