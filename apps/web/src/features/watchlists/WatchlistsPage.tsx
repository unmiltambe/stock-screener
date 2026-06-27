import { Link } from "react-router-dom";
import { useWatchlists } from "../../api/watchlists";

export default function WatchlistsPage() {
  const { data, isLoading, error } = useWatchlists();

  if (isLoading) return <p className="text-dim">Loading…</p>;
  if (error) return <p className="text-neg">Failed to load: {String(error)}</p>;

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Watchlists</h1>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {data!.map((w) => (
          <Link
            key={w.id}
            to={`/watchlists/${w.id}`}
            className="block rounded-lg border border-line bg-panel p-4 hover:border-accent transition-colors"
          >
            <div className="font-medium">{w.name}</div>
            <div className="text-dim text-sm">{w.count} tickers</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
