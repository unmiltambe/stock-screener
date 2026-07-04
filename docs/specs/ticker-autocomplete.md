# Spec — Ticker autocomplete + validation (symbol universe)

**Status:** proposed · **Date:** 2026-07-02 · Backlog [#1](../backlog.md) · shares the
universe with **Phase 4** discovery ([roadmap.md](../roadmap.md)). Universe design
decided in **[ADR-0011](../decisions/0011-symbol-universe.md)** (backend-owned,
market-abstracted).

## Goal

The Add-ticker box ([WatchlistDetailPage.tsx](../apps/web/src/features/watchlists/WatchlistDetailPage.tsx))
accepts any string today, so typos/junk get added and render as empty rows. Give it
**type-ahead autocomplete** over real symbols and **validate on add** so unknown
symbols are rejected with a clear message.

## Decisions & rationale

### 1. Universe source — NASDAQ Trader symbol directory
`nasdaqtraded.txt` (from `ftp.nasdaqtrader.com` / its HTTP mirror) lists **every
US-listed symbol** across NASDAQ/NYSE/NYSE American with a security name, listing
exchange, and an **ETF flag** — exactly the "full major-exchange list incl. ETFs"
we want (~8–12k symbols). We filter out test issues and non-traded rows.
- *Rejected:* SEC `company_tickers.json` (no ETFs, no clean exchange); a third-party
  search API (needless dependency + per-request cost).

### 2. Storage & serving — backend-owned, fetched once + cached, markets compose ([ADR-0011](../decisions/0011-symbol-universe.md))
A `SymbolUniversePort` adapter (beside `MarketDataPort`) with a `UsSymbolUniverse`
impl over NASDAQ Trader fetches + parses the directory to `{symbol, name, exchange, market}`.
The universe is **cached per market** (long TTL) and served to all users — **not**
shipped to the client, **not** fetched per request ([P5](../constitution.md)).
**Markets are additive:** a registry composes the *enabled* markets (just US now)
into one searchable set, so a user can hold US + non-US symbols in the same watchlist.
Symbols use their **canonical yfinance id** (`AAPL`, `RELIANCE.NS`, `7203.T`), so
mixed-market lists resolve through the existing data path with no schema change.
India/Japan are future adapters added to the enabled set (backlog [#16](../backlog.md)).

### 3. Search — backend endpoint, spans enabled markets
`GET /v1/symbols/search?q=` searches **all enabled markets** and returns ranked
matches (`{symbol, name, exchange, market}`; exact-symbol → prefix → name-substring,
cap ~8) from the composed universe; ranking is a **pure function**. An optional
`&market=` *filters* results (not a single-select). The frontend calls it
**debounced** and caches results (React Query); the dropdown shows the exchange so
same-named symbols across markets are distinguishable.

### 4. Validation — eager, against the universe (server-authoritative)
On add, uppercase + check the symbol resolves in the universe (via the search
endpoint). In → add. Not found → reject with a concise message ("`FOO` isn't a
recognized US symbol"). The universe lives server-side, so validation is
authoritative rather than a client guess.
- Edge cases the directory may miss (brand-new listings, some foreign/ADR) →
  deferred; a "add anyway?" soft-override can come later if it bites.

## Integration with multi-ticker add (backlog #2, next)

Designed so #2 drops in cleanly: the Add box keeps a **single text input**.
- **Single entry** → autocomplete dropdown + pick-to-fill (this spec).
- **Paste of several** (`"AAPL, MSFT NVDA"`) → autocomplete suppresses once the input
  contains a separator; on submit we split on `[,\s]+`, **validate each against the
  same universe**, add the valid ones, and report the rest ("Added 3; couldn't find
  FOO"). Same universe + validation, reused — no second data path.

## Changes by layer

- **Backend** ([ADR-0011](../decisions/0011-symbol-universe.md)):
  - `adapters/`: `SymbolUniversePort` interface + `UsSymbolUniverse` — fetch + parse
    NASDAQ Trader `nasdaqtraded.txt` → `{symbol, name, exchange, market}`. Drop test
    issues / non-traded; **filter to common stock + ETF** (drop warrants/units/rights/
    preferreds); **normalize class-share punctuation to Yahoo's form** (`BRK.B`→`BRK-B`)
    so the id matches yfinance (see ADR-0011 "Risk"). One impl per market; the enabled
    set is composed, not selected.
  - `core/`: a pure `search_symbols(universe, q, limit)` ranking function
    (exact → prefix → name-substring), operating over the composed list.
  - `api/`: a small **registry** unions the enabled markets' cached universes (just US
    now); `GET /v1/symbols/search?q=` ranks over that union and returns top-N. Each
    market's universe is fetched-on-miss + cached (long TTL); optional `&market=` filters.
  - Tests: parser (a known ticker + a known ETF, e.g. `SPY`/`QQQ`), ranking, and
    fetch-once/cache behaviour.
- **Frontend:**
  - `api/symbols.ts` — a **debounced** React Query hook over `/v1/symbols/search`.
  - A reusable **`TickerAutocomplete`** input (dropdown, keyboard nav ↑/↓/Enter/Esc)
    — extracted so both the single and future multi flows use it
    ([P9](../constitution.md)); renders safely for loading/empty/no-match ([P10](../constitution.md)).
  - Wire into `WatchlistDetailPage`'s Add form; validate on add.

## Refresh strategy

Server-side: v1 uses a **lazy long-TTL cache** (first miss fetches + caches the
universe for all users). A scheduled refresh folds into **Phase 4's** EventBridge
batch later — the same "precompute the universe" path ([ADR-0003](../decisions/0003-discovery-engine.md)).

## Testing / done

- Backend: parser resolves a known ticker + a known ETF (`SPY`/`QQQ`); ranking orders
  exact→prefix→name; the universe is fetched once then cache-served; `pytest` green.
- Autocomplete: typing `APP` surfaces `AAPL`/`APP`/…; keyboard nav works;
  loading/empty/no-match states render.
- Validation: a junk symbol is rejected with the message; a real one adds.
- `npm run build` green; verify in the preview (owner tests).
