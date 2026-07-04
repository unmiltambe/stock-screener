// Reusable type-ahead input over the symbol universe (ADR-0011 / spec
// ticker-autocomplete). Extracted so both the single-add flow and future
// multi-ticker add (#2) share one component (P9). Renders safely for
// loading / empty / no-match (P10).
import { useEffect, useRef, useState } from "react";
import { useSymbolSearch, type SymbolMatch } from "../../api/symbols";
import { useDebounced } from "../../lib/useDebounced";

const INPUT_CLASS =
  "w-44 bg-bg border border-line rounded px-3 py-1.5 text-sm font-mono outline-none focus:border-accent transition-colors";

export function TickerAutocomplete({
  value,
  onChange,
  onPick,
  disabled,
  placeholder = "Add ticker…",
}: {
  value: string;
  onChange: (v: string) => void;
  /** User selected a suggestion — already a valid symbol, add it directly. */
  onPick: (symbol: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const debounced = useDebounced(value, 150);
  const { data: matches = [], isFetching } = useSymbolSearch(open ? debounced : "");

  // Reset the highlight whenever the result set changes.
  useEffect(() => setHighlight(-1), [debounced]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(m: SymbolMatch) {
    setOpen(false);
    setHighlight(-1);
    onPick(m.symbol);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      // Only intercept Enter when a suggestion is highlighted; otherwise let the
      // surrounding form submit (which validates the typed value).
      if (open && highlight >= 0 && matches[highlight]) {
        e.preventDefault();
        pick(matches[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  }

  const showDropdown = open && debounced.trim().length >= 1;

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={12}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        className={INPUT_CLASS}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {showDropdown && (
        <ul className="absolute z-20 mt-1 w-72 max-h-64 overflow-auto bg-panel border border-line rounded-lg shadow-xl py-1 text-sm">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-dim text-xs">
              {isFetching ? "Searching…" : "No matching symbols"}
            </li>
          ) : (
            matches.map((m, i) => (
              <li
                key={`${m.symbol}-${m.market}`}
                // mousedown (not click) so it fires before the input blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={[
                  "px-3 py-1.5 cursor-pointer flex items-baseline gap-2",
                  i === highlight ? "bg-accent/10" : "",
                ].join(" ")}
              >
                <span className="font-mono font-medium shrink-0">{m.symbol}</span>
                <span className="text-dim text-xs truncate">{m.name}</span>
                <span className="text-dim text-[10px] ml-auto shrink-0">{m.exchange}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
