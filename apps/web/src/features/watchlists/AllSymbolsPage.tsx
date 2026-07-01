import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAllSymbols } from "../../api/watchlists";
import {
  BASE_ACCESSORS, ChartPanel, type SortDir, Th, TIPS, TickerTableHead, TickerTableRow, sortRows,
} from "./TickerTable";

// AllSymbols extends the base accessors with a `lists` sort key (watchlist count).
const ACCESSORS = { ...BASE_ACCESSORS, lists: (r: Parameters<typeof BASE_ACCESSORS.ticker>[0]) => r.lists.length };

const ALL_SORT_KEY = "wl-sort-_all";

function loadSort(): { key: string; dir: SortDir } {
  try {
    const raw = localStorage.getItem(ALL_SORT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { key: "combined", dir: "desc" };
}

export default function AllSymbolsPage() {
  const { data, isLoading, total, listCount } = useAllSymbols();
  const [sortKey, setSortKey] = useState<string | null>(() => loadSort().key);
  const [sortDir, setSortDir] = useState<SortDir>(() => loadSort().dir);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  function handleSort(key: string) {
    const newDir: SortDir = sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortKey(key);
    setSortDir(newDir);
    localStorage.setItem(ALL_SORT_KEY, JSON.stringify({ key, dir: newDir }));
  }

  const sort = { key: sortKey, dir: sortDir };
  const rows = sortRows(data, ACCESSORS, sortKey, sortDir);

  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (didAutoSelect.current || rows.length === 0) return;
    didAutoSelect.current = true;
    setSelectedTicker(rows[0].ticker);
  }, [rows]);

  const thProps = { sort, onSort: handleSort };

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/" className="text-accent text-sm inline-flex items-center gap-1">
          <ArrowLeft size={14} strokeWidth={1.75} /> watchlists
        </Link>
        <span className="text-dim text-sm">/</span>
        <span className="text-sm font-semibold">All Symbols</span>
        <span className="text-[10px] text-dim bg-line px-2 py-0.5 rounded">Built-in</span>
        {!isLoading && (
          <span className="text-dim text-xs ml-auto">
            {total} symbols across {listCount} watchlists
          </span>
        )}
      </div>

      {isLoading && <p className="text-dim">Loading symbols…</p>}

      {!isLoading && data.length > 0 && (
        <>
          {selectedTicker && (
            <ChartPanel ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
          )}

          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <TickerTableHead
                sort={sort}
                onSort={handleSort}
                extraGroupHeader={
                  <th className="pb-1 border-l border-line/40 pl-3 text-dim">Lists</th>
                }
                extraHeader={
                  <Th tip={TIPS.lists} sortK="lists" {...thProps} className="pl-3 pt-1 border-l border-line/40">
                    Watchlists
                  </Th>
                }
              />
              <tbody>
                {rows.map((r) => (
                  <TickerTableRow
                    key={r.ticker}
                    r={r}
                    isSelected={selectedTicker === r.ticker}
                    onClick={() => setSelectedTicker((p) => p === r.ticker ? null : r.ticker)}
                    extraCell={
                      <td className="pr-2 whitespace-nowrap border-l border-line/40 pl-3">
                        <div className="flex flex-wrap gap-1">
                          {r.lists.map((l) => (
                            <span key={l} className="text-[10px] text-dim bg-line px-1.5 py-0.5 rounded">{l}</span>
                          ))}
                        </div>
                      </td>
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isLoading && data.length === 0 && (
        <p className="text-dim text-sm mt-8 text-center">
          No symbols yet — add tickers to your watchlists to see them here.
        </p>
      )}
    </div>
  );
}
