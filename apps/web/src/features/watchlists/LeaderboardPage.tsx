import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, TrendingUp, Star, ShieldAlert, Zap } from "lucide-react";
import { Breadcrumb } from "./TickerTable";
import { useLeaderboard } from "../../api/leaderboard";
import type { SignalRow, TickerRow } from "../../api/types";
import { fmtNum, fmtPctAdaptive, scoreColor, signalColor, dayChangeColor } from "../../lib/format";

// ── shared row components ─────────────────────────────────────────────────────

function RankedRow({ rank, row }: { rank: number; row: TickerRow }) {
  const v = row.scores.combined;
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

function SignalRowItem({ row }: { row: SignalRow }) {
  return (
    <Link
      to={`/tickers/${row.ticker}`}
      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-line/30 transition-colors"
    >
      <div className="flex gap-1 shrink-0">
        {row.chips.map((chip) => (
          <span
            key={chip.label}
            className="text-xs font-mono px-1.5 py-0.5 rounded border border-accent/40 text-accent bg-accent/5 whitespace-nowrap"
          >
            {chip.label} {chip.bars}d
          </span>
        ))}
      </div>
      <span className="font-medium w-14 shrink-0">{row.ticker}</span>
      <span className="text-dim text-sm flex-1 truncate">{row.name}</span>
      <span className={`text-xs shrink-0 ${row.signal ? signalColor(row.signal) : "text-dim"}`}>
        {row.signal ?? "—"}
      </span>
    </Link>
  );
}

function ExitRowItem({ row }: { row: SignalRow }) {
  return (
    <Link
      to={`/tickers/${row.ticker}`}
      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-line/30 transition-colors"
    >
      <div className="flex gap-1 shrink-0">
        {row.chips.map((chip) => (
          <span
            key={chip.label}
            className="text-xs font-mono px-1.5 py-0.5 rounded border border-neg/40 text-neg bg-neg/5 whitespace-nowrap"
          >
            {chip.label} {chip.bars}d
          </span>
        ))}
      </div>
      <span className="font-medium w-14 shrink-0">{row.ticker}</span>
      <span className="text-dim text-sm flex-1 truncate">{row.name}</span>
      <span className={`text-xs shrink-0 ${row.signal ? signalColor(row.signal) : "text-dim"}`}>
        {row.signal ?? "—"}
      </span>
    </Link>
  );
}

function MoverRow({ row }: { row: TickerRow }) {
  const pct = row.dayChangePct;
  return (
    <Link
      to={`/tickers/${row.ticker}`}
      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-line/30 transition-colors"
    >
      <span className="font-medium text-sm w-14 shrink-0">{row.ticker}</span>
      <span className="text-dim text-xs flex-1 truncate">{row.name}</span>
      <span className={`font-mono text-xs w-12 text-right shrink-0 ${dayChangeColor(pct)}`}>
        {fmtPctAdaptive(pct)}
      </span>
    </Link>
  );
}

// ── card shells ───────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-panel p-4 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  accent = "accent",
  title,
  blurb,
}: {
  icon: React.ReactNode;
  accent?: "accent" | "neg";
  title: string;
  blurb: string;
}) {
  const border = accent === "neg" ? "border-neg/50 text-neg" : "border-accent text-accent";
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className={`border rounded p-1.5 shrink-0 ${border}`}>{icon}</div>
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-dim text-xs">{blurb}</p>
      </div>
    </div>
  );
}

// ── group label ───────────────────────────────────────────────────────────────

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs font-semibold tracking-widest text-dim uppercase">{label}</span>
      <div className="flex-1 border-t border-line" />
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { data, isLoading } = useLeaderboard();

  if (isLoading) return <p className="text-dim">Tallying the standings…</p>;

  const hasData =
    data &&
    ((data.entry_signals?.length ?? 0) > 0 ||
      (data.exit_warnings?.length ?? 0) > 0 ||
      (data.best_positioned?.length ?? 0) > 0 ||
      (data.top_movers_up?.length ?? 0) > 0 ||
      (data.top_movers_down?.length ?? 0) > 0);

  if (!data || !hasData) {
    return (
      <div className="max-w-md mx-auto text-center mt-16">
        <h1 className="text-lg font-semibold mb-2">Your leaderboard is waiting</h1>
        <p className="text-dim text-sm">
          Add a few tickers to your watchlists and the rankings fill in here —
          entry signals, best positioned, and today's movers.
        </p>
        <Link to="/watchlists" className="inline-flex items-center gap-1 mt-5 text-accent text-sm hover:underline">
          <ArrowLeft size={14} strokeWidth={1.75} /> Back to watchlists
        </Link>
      </div>
    );
  }

  const entrySignals = data?.entry_signals ?? [];
  const exitWarnings = data?.exit_warnings ?? [];
  const bestPositioned = data?.best_positioned ?? [];
  const moversUp = data?.top_movers_up ?? [];
  const moversDown = data?.top_movers_down ?? [];

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
        Your daily briefing — one question: should I do anything today? Want every
        name in one sortable table? That's{" "}
        <Link to="/watchlists/_all" className="text-accent hover:underline">All Symbols</Link>.
      </p>

      {/* ── ACT ───────────────────────────────────────────────────────────── */}
      <GroupLabel label="Act" />
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Entry Signals */}
        <Card>
          <CardHeader
            icon={<Zap size={18} strokeWidth={1.5} />}
            title="Entry Signals"
            blurb="Fresh positive crossovers with strong fundamentals."
          />
          <div className="-mx-1">
            {entrySignals.length === 0 ? (
              <p className="text-dim text-sm px-3 py-2">No fresh entry signals today.</p>
            ) : (
              entrySignals.map((r) => <SignalRowItem key={r.ticker} row={r} />)
            )}
          </div>
        </Card>

        {/* Exit Warnings */}
        <Card>
          <CardHeader
            icon={<ShieldAlert size={18} strokeWidth={1.5} />}
            accent="neg"
            title="Exit Warnings"
            blurb="Recent negative crossovers in your watchlists."
          />
          <div className="-mx-1">
            {exitWarnings.length === 0 ? (
              <p className="text-dim text-sm px-3 py-2">No exit warnings today.</p>
            ) : (
              exitWarnings.map((r) => <ExitRowItem key={r.ticker} row={r} />)
            )}
          </div>
        </Card>
      </div>

      {/* ── MONITOR ───────────────────────────────────────────────────────── */}
      <GroupLabel label="Monitor" />
      <div className="grid gap-4 md:grid-cols-2">
        {/* Best Positioned */}
        <Card>
          <CardHeader
            icon={<Star size={18} strokeWidth={1.5} />}
            title="Best Positioned"
            blurb="Highest combined scores across your universe."
          />
          <div className="-mx-1">
            {bestPositioned.length === 0 ? (
              <p className="text-dim text-sm px-3 py-2">Nothing here yet.</p>
            ) : (
              bestPositioned.map((r, i) => <RankedRow key={r.ticker} rank={i + 1} row={r} />)
            )}
          </div>
        </Card>

        {/* Today's Movers — two columns inside one card */}
        <Card>
          <CardHeader
            icon={<TrendingUp size={18} strokeWidth={1.5} />}
            title="Today's Movers"
            blurb="Biggest moves across your watchlists."
          />
          {moversUp.length === 0 && moversDown.length === 0 ? (
            <p className="text-dim text-sm px-3 py-2">No significant moves today.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <p className="text-xs text-dim font-medium mb-1 px-2">↑ Gainers</p>
                <div className="-mx-1">
                  {moversUp.length === 0
                    ? <p className="text-dim text-xs px-3 py-1">—</p>
                    : moversUp.map((r) => <MoverRow key={r.ticker} row={r} />)}
                </div>
              </div>
              <div>
                <p className="text-xs text-dim font-medium mb-1 px-2">↓ Decliners</p>
                <div className="-mx-1">
                  {moversDown.length === 0
                    ? <p className="text-dim text-xs px-3 py-1">—</p>
                    : moversDown.map((r) => <MoverRow key={r.ticker} row={r} />)}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
