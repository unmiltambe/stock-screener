import { Link, useParams } from "react-router-dom";
import { useWatchlist } from "../../api/watchlists";
import { fmtNum, fmtPrice, scoreColor, signalColor } from "../../lib/format";

export default function WatchlistDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useWatchlist(id);

  if (isLoading) return <p className="text-dim">Loading…</p>;
  if (error) return <p className="text-neg">Failed to load: {String(error)}</p>;

  return (
    <div>
      <Link to="/" className="text-accent text-sm">← watchlists</Link>
      <table className="w-full mt-4 text-sm">
        <thead>
          <tr className="text-dim text-left border-b border-line">
            <th className="py-2">Ticker</th>
            <th>Company</th>
            <th className="text-right">Price</th>
            <th className="text-right">Fund</th>
            <th className="text-right">Tech</th>
            <th className="text-right">Combined</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {data!.map((r) => (
            <tr key={r.ticker} className="border-b border-line/50 hover:bg-panel">
              <td className="py-2 font-medium font-mono">{r.ticker}</td>
              <td className="text-dim">{(r.name ?? "").slice(0, 28)}</td>
              <td className="text-right font-mono">{fmtPrice(r.price)}</td>
              <td className={`text-right font-mono ${scoreColor(r.scores.fund)}`}>{fmtNum(r.scores.fund, 0)}</td>
              <td className={`text-right font-mono ${scoreColor(r.scores.tech)}`}>{fmtNum(r.scores.tech, 0)}</td>
              <td className={`text-right font-mono ${scoreColor(r.scores.combined)}`}>{fmtNum(r.scores.combined, 0)}</td>
              <td className={signalColor(r.signal)}>{r.signal ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
