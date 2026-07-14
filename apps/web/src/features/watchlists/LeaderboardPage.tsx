import { Link } from "react-router-dom";
import { Activity, ArrowLeft, ArrowRight, Rocket, Scale, TrendingUp, RotateCcw, TrendingDown, type LucideIcon } from "lucide-react";
import { Breadcrumb } from "./TickerTable";
import { useLeaderboard } from "../../api/leaderboard";
import { useAllSymbols } from "../../api/watchlists";
import type { Leaderboard, TickerRow } from "../../api/types";
import { fmtNum, fmtPctAdaptive, scoreColor, signalColor, dayChangeColor } from "../../lib/format";

// The opinionated companion to All Symbols: a curated "best picks first" read,
// not a full table. Four ranked angles across everything you track.
const SECTIONS: {
  key: keyof Leaderboard;
  title: string;
  blurb: string;
  icon: LucideIcon;
  metric: (r: TickerRow) => number | null;
}[] = [
  { key: "top_opportunities", title: "Top Opportunities", blurb: "Best combined scores right now.",
    icon: Rocket, metric: (r) => r.scores.combined },
  { key: "best_value", title: "Best Value", blurb: "Strong fundamentals at sensible prices.",
    icon: Scale, metric: (r) => r.scores.fund },
  { key: "best_momentum", title: "Best Momentum", blurb: "Riding the strongest trends.",
    icon: Activity, metric: (r) => r.scores.tech },
  { key: "reconsider", title: "Worth a Second Look", blurb: "Lagging the pack — patience or a trim?",
    icon: RotateCcw, metric: (r) => r.scores.combined },
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
      <span className={`text-xs w-12 text-right ${row.signal ? signalColor(row.signal) : "text-dim"}`}>
        {row.signal ?? "—"}
      </span>
      <span className={`font-mono text-sm w-10 text-right ${scoreColor(v)}`}>{fmtNum(v, 0)}</span>
    </Link>
  );
}

function MoverRow({ rank, row }: { rank: number; row: TickerRow }) {
  const pct = row.dayChangePct;
  return (
    <Link
      to={`/tickers/${row.ticker}`}
      className="flex items-center gap-3 px-3 py-2 rounded hover:bg-line/30 transition-colors"
    >
      <span className="text-dim text-xs w-4 tabular-nums">{rank}</span>
      <span className="font-medium w-16">{row.ticker}</span>
      <span className="text-dim text-sm flex-1 truncate">{row.name}</span>
      <span className={`font-mono text-sm w-14 text-right ${dayChangeColor(pct)}`}>
        {fmtPctAdaptive(pct)}
      </span>
    </Link>
  );
}

export default function LeaderboardPage() {
  const { data, isLoading } = useLeaderboard();
  const { data: allRows } = useAllSymbols();

  if (isLoading) return <p className="text-dim">Tallying the standings…</p>;

  const withChange = allRows.filter((r) => r.dayChangePct != null);
  const topMovers = [...withChange].sort((a, b) => b.dayChangePct! - a.dayChangePct!).slice(0, 5);
  const bottomMovers = [...withChange].sort((a, b) => a.dayChangePct! - b.dayChangePct!).slice(0, 5);

  const empty = data && SECTIONS.every((s) => (data[s.key] ?? []).length === 0);
  if (!data || empty) {
    return (
      <div className="max-w-md mx-auto text-center mt-16">
        <h1 className="text-lg font-semibold mb-2">Your leaderboard is waiting</h1>
        <p className="text-dim text-sm">
          Add a few tickers to your watchlists and the rankings fill in here —
          best value, best momentum, and the ones worth a second look.
        </p>
        <Link to="/watchlists" className="inline-flex items-center gap-1 mt-5 text-accent text-sm hover:underline">
          <ArrowLeft size={14} strokeWidth={1.75} /> Back to watchlists
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <Breadcrumb crumbs={[{ label: "watchlists", to: "/watchlists" }, { label: "Leaderboard", to: "/leaderboard" }]} />
      </div>
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

      {(topMovers.length > 0 || bottomMovers.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 flex items-center gap-3">
              <div className="border border-accent rounded p-1.5 text-accent shrink-0">
                <TrendingUp size={18} strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-medium">Top Movers Today</h2>
                <p className="text-dim text-xs">Biggest gains across your watchlists.</p>
              </div>
            </div>
            <div className="-mx-1">
              {topMovers.map((r, i) => <MoverRow key={r.ticker} rank={i + 1} row={r} />)}
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 flex items-center gap-3">
              <div className="border border-neg/50 rounded p-1.5 text-neg shrink-0">
                <TrendingDown size={18} strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-medium">Biggest Drops Today</h2>
                <p className="text-dim text-xs">Sharpest declines across your watchlists.</p>
              </div>
            </div>
            <div className="-mx-1">
              {bottomMovers.map((r, i) => <MoverRow key={r.ticker} rank={i + 1} row={r} />)}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const rows = data[s.key] ?? [];
          return (
            <div key={s.key} className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-2 flex items-center gap-3">
                <div className="border border-accent rounded p-1.5 text-accent shrink-0">
                  <s.icon size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-medium">{s.title}</h2>
                  <p className="text-dim text-xs">{s.blurb}</p>
                </div>
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
