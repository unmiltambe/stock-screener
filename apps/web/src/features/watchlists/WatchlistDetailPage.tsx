import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAddTicker,
  useRemoveTicker,
  useWatchlist,
  useWatchlists,
} from "../../api/watchlists";
import { fmtNum, fmtPrice, scoreColor, signalColor } from "../../lib/format";

export default function WatchlistDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useWatchlist(id);
  const { data: watchlists } = useWatchlists();
  const addTicker = useAddTicker(id);
  const removeTicker = useRemoveTicker(id);
  const [tickerInput, setTickerInput] = useState("");

  const watchlistName = watchlists?.find((w) => w.id === id)?.name ?? "Watchlist";

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const symbol = tickerInput.trim().toUpperCase();
    if (!symbol) return;
    addTicker.mutate(symbol, { onSuccess: () => setTickerInput("") });
  }

  if (isLoading) return <p className="text-dim">Loading…</p>;
  if (error) return <p className="text-neg">Failed to load: {String(error)}</p>;

  return (
    <div>
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
        <p className="text-dim text-sm mt-8 text-center">
          No tickers yet — add one above.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-dim text-left border-b border-line">
              <th className="py-2">Ticker</th>
              <th>Company</th>
              <th className="text-right">Price</th>
              <th className="text-right">Fund</th>
              <th className="text-right">Tech</th>
              <th className="text-right">Combined</th>
              <th>Signal</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {data!.map((r) => (
              <tr key={r.ticker} className="group border-b border-line/50 hover:bg-panel">
                <td className="py-2 font-medium font-mono">{r.ticker}</td>
                <td className="text-dim">{(r.name ?? "").slice(0, 28)}</td>
                <td className="text-right font-mono">{fmtPrice(r.price)}</td>
                <td className={`text-right font-mono ${scoreColor(r.scores.fund)}`}>
                  {fmtNum(r.scores.fund, 0)}
                </td>
                <td className={`text-right font-mono ${scoreColor(r.scores.tech)}`}>
                  {fmtNum(r.scores.tech, 0)}
                </td>
                <td className={`text-right font-mono ${scoreColor(r.scores.combined)}`}>
                  {fmtNum(r.scores.combined, 0)}
                </td>
                <td className={signalColor(r.signal)}>{r.signal ?? "—"}</td>
                <td className="pl-2">
                  <button
                    onClick={() => removeTicker.mutate(r.ticker)}
                    title={`Remove ${r.ticker}`}
                    className="opacity-0 group-hover:opacity-100 text-dim hover:text-neg transition-opacity text-lg leading-none"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
