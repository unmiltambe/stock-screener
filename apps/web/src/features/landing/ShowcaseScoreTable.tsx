// Compact 5-column score table for the landing hero (spec: home-landing.md, D3).
// A deliberately small, presentational view over the SAME live `TickerRow` data and
// the SAME `lib/format` helpers the dashboard uses — so it's real, never a stale
// screenshot, and duplicates no scoring/label logic. It is NOT the shared
// `TickerTable` (which carries ~18 columns, grouped headers, sort, and an expandable
// chart row); reusing that here would mean a risky refactor for a one-panel need.

import type { TickerRow } from "../../api/types";
import { fmtNum, fmtPrice, scoreColor, signalColor } from "../../lib/format";

export function ShowcaseScoreTable({
  rows,
  selectedTicker,
  onSelect,
}: {
  rows: TickerRow[];
  selectedTicker?: string | null;
  onSelect?: (ticker: string) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-dim text-xs border-b border-line">
          <th className="py-1.5 pl-3 pr-3 text-left font-normal">Ticker</th>
          <th className="py-1.5 pr-4 text-right font-normal">Price</th>
          <th className="py-1.5 pr-3 text-right font-normal">Fundamental</th>
          <th className="py-1.5 pr-3 text-right font-normal">Technical</th>
          <th className="py-1.5 pr-3 text-right font-normal">Overall</th>
          <th className="py-1.5 pr-3 text-right font-normal">Signal</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isSelected = selectedTicker === r.ticker;
          return (
            <tr
              key={r.ticker}
              onClick={() => onSelect?.(r.ticker)}
              className={[
                "border-b border-line/50 transition-colors",
                onSelect ? "cursor-pointer" : "",
                isSelected ? "bg-accent/10" : "hover:bg-panel",
              ].join(" ")}
            >
              <td className="py-2 pl-3 pr-3 font-medium font-mono whitespace-nowrap">
                <span className={isSelected ? "text-accent" : ""}>{r.ticker}</span>
              </td>
              <td className="pr-4 text-right font-mono whitespace-nowrap">{fmtPrice(r.price)}</td>
              <td className={`pr-3 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.fund)}`}>
                {fmtNum(r.scores.fund, 0)}
              </td>
              <td className={`pr-3 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.tech)}`}>
                {fmtNum(r.scores.tech, 0)}
              </td>
              <td className={`pr-3 text-right font-mono whitespace-nowrap ${scoreColor(r.scores.combined)}`}>
                {fmtNum(r.scores.combined, 0)}
              </td>
              <td className={`py-2 pr-3 text-right font-medium whitespace-nowrap ${signalColor(r.signal)}`}>
                {r.signal ?? "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
