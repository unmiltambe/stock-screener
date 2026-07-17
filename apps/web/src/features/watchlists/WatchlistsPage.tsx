import { useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import {
  useAllSymbols,
  useCreateWatchlist,
  useDeleteWatchlist,
  useRenameWatchlist,
  useWatchlists,
} from "../../api/watchlists";

export default function WatchlistsPage() {
  const { data, isLoading, error } = useWatchlists();
  const { total: allTotal, listCount } = useAllSymbols();
  const createWL = useCreateWatchlist();
  const renameWL = useRenameWatchlist();
  const deleteWL = useDeleteWatchlist();

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createWL.mutate(name, {
      onSuccess: () => { setNewName(""); setShowNew(false); },
    });
  }

  function startRename(id: string, currentName: string) {
    setEditingId(id);
    setEditName(currentName);
  }

  function submitRename(id: string, e: React.FormEvent) {
    e.preventDefault();
    const name = editName.trim();
    if (name) renameWL.mutate({ id, name }, { onSuccess: () => setEditingId(null) });
    else setEditingId(null);
  }

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteWL.mutate(id);
    }
  }

  if (isLoading || !data) return <p className="text-dim">Pulling your lists together…</p>;
  if (error) return <p className="text-neg">Hmm, couldn't load that: {String(error)}</p>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-lg font-semibold">Watchlists</h1>
        <button
          onClick={() => setShowNew(true)}
          className="text-sm px-3 py-1.5 rounded border border-line hover:border-accent text-accent transition-colors"
        >
          + New watchlist
        </button>
      </div>
      <p className="text-dim text-sm mb-6">
        Organise your tickers into lists and let the scoring do the work.
      </p>

      {/* Built-in boards: the full table (All Symbols) */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-sm font-bold tracking-widest uppercase">Built-in views</span>
          <div className="flex-1 border-t border-line" />
        </div>
        <p className="text-dim text-sm mb-4">Cross-list views that span everything you track.</p>
        <Link
          to="/watchlists/_all"
          className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 hover:border-accent/60 transition-colors group"
        >
          <div>
            <div className="font-medium">All Symbols</div>
            <div className="text-dim text-sm mt-0.5">
              {allTotal > 0
                ? `${allTotal} symbols across ${listCount} lists, scored and ranked`
                : "Every ticker you follow, scored and ranked"}
            </div>
          </div>
          <LayoutGrid className="text-dim group-hover:text-accent transition-colors shrink-0" size={18} strokeWidth={1.5} />
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-1 mt-6">
        <span className="text-sm font-bold tracking-widest uppercase">Your watchlists</span>
        <div className="flex-1 border-t border-line" />
      </div>
      <p className="text-dim text-sm mb-4">Custom groups — organise by theme, sector, or conviction.</p>
      {data.length === 0 && (
        <p className="text-dim text-sm mb-3">
          No lists yet — create one to get started.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {data.map((w) => (
          <div
            key={w.id}
            className="group rounded-lg border border-line bg-panel p-4 hover:border-accent/50 transition-colors"
          >
            {editingId === w.id ? (
              <form onSubmit={(e) => submitRename(w.id, e)} className="flex gap-2 items-center">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => setEditingId(null)}
                  className="flex-1 bg-transparent border-b border-accent outline-none text-sm font-medium py-0.5"
                />
                {/* preventDefault on mousedown keeps the input focused so its
                    onBlur (cancel) doesn't unmount the form before this submits */}
                <button
                  type="submit"
                  onMouseDown={(e) => e.preventDefault()}
                  className="text-accent text-xs shrink-0"
                >
                  Save
                </button>
              </form>
            ) : (
              <Link to={`/watchlists/${w.id}`} className="block">
                <div className="font-medium">{w.name}</div>
                <div className="text-dim text-sm mt-0.5">{w.count} tickers</div>
              </Link>
            )}
            <div className="mt-3 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => startRename(w.id, w.name)}
                className="text-xs text-dim hover:text-ink transition-colors"
              >
                Rename
              </button>
              <button
                onClick={() => handleDelete(w.id, w.name)}
                className="text-xs text-dim hover:text-neg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div
          className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowNew(false)}
        >
          <form
            onSubmit={submitNew}
            className="bg-panel border border-line rounded-lg p-6 w-80 shadow-2xl"
          >
            <h2 className="font-semibold mb-4">New watchlist</h2>
            <input
              autoFocus
              placeholder="Name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-bg border border-line rounded px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setShowNew(false); setNewName(""); }}
                className="text-sm text-dim hover:text-ink px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createWL.isPending || !newName.trim()}
                className="text-sm px-3 py-1.5 rounded bg-accent text-bg font-medium disabled:opacity-40 transition-opacity"
              >
                {createWL.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
