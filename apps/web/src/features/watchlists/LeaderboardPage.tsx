import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLeaderboard } from "../../api/leaderboard";
import type { Leaderboard, TickerRow } from "../../api/types";
import { fmtNum, scoreColor, signalColor } from "../../lib/format";

// The opinionated companion to All Symbols: a curated "best picks first" read,
// not a full table. Four ranked angles across everything you track.
const SECTIONS: {
  key: keyof Leaderboard;
  title: string;
  blurb: string;
  metric: (r: TickerRow) => number | null;
}[] = [
  { key: "top_opportunities", title: "Top Opportunities", blurb: "Best combined scores right now.",
    metric: (r) => r.scores.combined },
  { key: "best_value", title: "Best Value", blurb: "Strong fundamentals at sensible prices.",
    metric: (r) => r.scores.fund },
  { key: "best_momentum", title: "Best Momentum", blurb: "Riding the strongest trends.",
    metric: (r) => r.scores.tech },
  { key: "reconsider", title: "Worth a Second Look", blurb: "Lagging the pack — patience or a trim?",
    metric: (r) => r.scores.combined },
];

function Row({ rank, row, metric }: {
  rank: number; row: TickerRow; metric: (r: TickerRow) => number | null;
}) {
  const v = metric(row);
  return (
    <Link
      to={`/tickers/${row.ticker}`}
      className="flex items-center gap-3 px-3 py-2 rounded hover:bg-line/30 transition-colors"
    >
      <span className="text-dim text-xs w-4 tabular-nums">{rank}</span>
      <span className="font-medium w-16">{row.ticker}</span>
      <span className="text-dim text-sm flex-1 truncate">{row.name}</span>
      {row.signal && (
        <span className={`text-xs ${signalColor(row.signal)}`}>{row.signal}</span>
      )}
      <span className={`font-mono text-sm w-10 text-right ${scoreColor(v)}`}>{fmtNum(v, 0)}</span>
    </Link>
  );
}

export default function LeaderboardPage() {
  const { data, isLoading } = useLeaderboard();

  if (isLoading) return <p className="text-dim">Tallying the standings…</p>;

  const empty = data && SECTIONS.every((s) => (data[s.key] ?? []).length === 0);
  if (!data || empty) {
    return (
      <div className="max-w-md mx-auto text-center mt-16">
        <h1 className="text-lg font-semibold mb-2">Your leaderboard is waiting</h1>
        <p className="text-dim text-sm">
          Add a few tickers to your watchlists and the rankings fill in here —
          best value, best momentum, and the ones worth a second look.
        </p>
        <Link to="/" className="inline-flex items-center gap-1 mt-5 text-accent text-sm hover:underline">
          <ArrowLeft size={14} strokeWidth={1.75} /> Back to watchlists
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-lg font-semibold">Leaderboard</h1>
        <Link to="/watchlists/_all" className="text-accent text-sm hover:underline inline-flex items-center gap-1">
          See the full board <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </div>
      <p className="text-dim text-sm mb-6">
        The highlights across everything you track. Want every name in one sortable
        table? That's <Link to="/watchlists/_all" className="text-accent hover:underline">All Symbols</Link>.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const rows = data[s.key] ?? [];
          return (
            <div key={s.key} className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-2">
                <h2 className="font-medium">{s.title}</h2>
                <p className="text-dim text-xs">{s.blurb}</p>
              </div>
              {rows.length === 0 ? (
                <p className="text-dim text-sm px-3 py-2">Nothing here yet.</p>
              ) : (
                <div className="-mx-1">
                  {rows.map((r, i) => (
                    <Row key={r.ticker} rank={i + 1} row={r} metric={s.metric} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
