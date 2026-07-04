import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  useAddTickers,
  useRemoveTicker,
  useWatchlist,
  useWatchlists,
} from "../../api/watchlists";
import {
  BASE_ACCESSORS, ChartPanel, type SortDir, TickerTableHead, TickerTableRow, sortRows,
} from "./TickerTable";
import { TickerAutocomplete } from "./TickerAutocomplete";
import { parseSymbols, validateSymbols } from "../../api/symbols";

const SORT_KEY_PREFIX = "wl-sort-";

function loadSort(id: string): { key: string; dir: SortDir } {
  try {
    const raw = localStorage.getItem(SORT_KEY_PREFIX + id);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { key: "ticker", dir: "asc" };
}

export default function WatchlistDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useWatchlist(id);
  const { data: watchlists } = useWatchlists();
  const addTickers = useAddTickers(id);
  const removeTicker = useRemoveTicker(id);

  const [tickerInput, setTickerInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(() => loadSort(id).key);
  const [sortDir, setSortDir] = useState<SortDir>(() => loadSort(id).dir);

  const watchlistName = watchlists?.find((w) => w.id === id)?.name ?? "Watchlist";

  const autoSelectedForId = useRef<string | null>(null);
  useEffect(() => {
    if (!data || data.length === 0) return;
    if (autoSelectedForId.current === id) return;
    autoSelectedForId.current = id;
    setSelectedTicker(sortRows(data, BASE_ACCESSORS, sortKey, sortDir)[0].ticker);
  }, [data, id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(key: string) {
    const newDir: SortDir = sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortKey(key);
    setSortDir(newDir);
    localStorage.setItem(SORT_KEY_PREFIX + id, JSON.stringify({ key, dir: newDir }));
  }

  // Picked from the dropdown — already a valid symbol, add it directly.
  function add(symbol: string) {
    setAddError(null);
    addTickers.mutate([symbol], { onSuccess: () => setTickerInput("") });
  }

  // Typed-and-submitted: parse one or many (split on commas/whitespace, #2),
  // validate each against the universe, add the valid ones, report the rest.
  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const symbols = parseSymbols(tickerInput);
    if (symbols.length === 0) return;
    setAddError(null);
    const { valid, unknown } = await validateSymbols(symbols);
    if (valid.length) {
      addTickers.mutate(valid, {
        onSuccess: () => { if (unknown.length === 0) setTickerInput(""); },
      });
    }
    if (unknown.length) {
      setAddError(
        valid.length
          ? `Added ${valid.length}; couldn't find ${unknown.join(", ")}`
          : unknown.length === 1
            ? `${unknown[0]} isn't a recognized US symbol`
            : `Couldn't find ${unknown.join(", ")}`,
      );
    }
  }

  if (isLoading) return <p className="text-dim">Loading…</p>;
  if (error) return <p className="text-neg">Failed to load: {String(error)}</p>;

  const sort = { key: sortKey, dir: sortDir };
  const rows = sortRows(data!, BASE_ACCESSORS, sortKey, sortDir);

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/" className="text-accent inline-flex items-center gap-1">
            <ArrowLeft size={14} strokeWidth={1.75} /> watchlists
          </Link>
          <span className="text-dim">/</span>
          <span className="font-semibold">{watchlistName}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <form onSubmit={submitAdd} className="flex gap-2">
            <TickerAutocomplete
              value={tickerInput}
              onChange={(v) => { setTickerInput(v); setAddError(null); }}
              onPick={add}
              disabled={addTickers.isPending}
            />
            <button
              type="submit"
              disabled={addTickers.isPending || !tickerInput.trim()}
              className="text-sm px-3 py-1.5 rounded border border-line hover:border-accent text-accent transition-colors disabled:opacity-40"
            >
              {addTickers.isPending ? "Adding…" : "Add"}
            </button>
          </form>
          {addError && <p className="text-neg text-xs">{addError}</p>}
        </div>
      </div>

      {data!.length === 0 ? (
        <p className="text-dim text-sm mt-8 text-center">No tickers yet — add one above.</p>
      ) : (
        <>
          {selectedTicker && (
            <ChartPanel
              ticker={selectedTicker}
              watchlistId={id}
              onClose={() => setSelectedTicker(null)}
            />
          )}

          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <TickerTableHead
                sort={sort}
                onSort={handleSort}
                extraGroupHeader={<th className="pb-1 w-6" />}
                extraHeader={<th className="w-6 pt-1" />}
              />
              <tbody>
                {rows.map((r) => (
                  <TickerTableRow
                    key={r.ticker}
                    r={r}
                    isSelected={selectedTicker === r.ticker}
                    onClick={() => setSelectedTicker((prev) => prev === r.ticker ? null : r.ticker)}
                    extraCell={
                      <td className="pl-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => removeTicker.mutate(r.ticker)}
                          title={`Remove ${r.ticker}`}
                          className="opacity-0 group-hover:opacity-100 text-dim hover:text-neg transition-opacity text-lg leading-none"
                        >×</button>
                      </td>
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
