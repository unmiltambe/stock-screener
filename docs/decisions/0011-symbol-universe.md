# ADR-0011 — Symbol universe: backend-owned, market-abstracted

**Status:** accepted  
**Date:** 2026-07-02  
**Relates to:** [constitution P3, P5](../constitution.md) ·
[ADR-0003](0003-discovery-engine.md) (discovery universe) · backlog
[#1](../backlog.md) (autocomplete/validation), [#16](../backlog.md) (international markets) ·
spec [ticker-autocomplete.md](../specs/ticker-autocomplete.md)

## Context

Ticker autocomplete + validation (backlog #1) needs a **symbol universe** — the list
of tradable symbols with name + exchange. Phase 4 discovery needs the same universe.
Two questions: **where does the universe live and get fetched**, and **how do we
support more markets later** (US now; India, Japan, … later)?

A correctness note that shapes the design: the symbol *universe* (what exists) is
**not** available from yfinance — yfinance fetches *per-ticker* price/fundamentals,
not a symbol list. The universe comes from **per-market exchange directories**
(US: NASDAQ Trader `nasdaqtraded.txt`; India: NSE/BSE; Japan: JPX). So the universe
*source* is a separate concern from the per-ticker *data* mechanism (yfinance,
`MarketDataPort`).

## Decision

**The backend owns the symbol universe, behind per-market adapters whose universes
compose into one searchable set — fetched once and cached, never shipped to or
fetched by the client per request.**

- A **`SymbolUniversePort`** adapter interface (in `services/app/adapters`, beside
  the existing `MarketDataPort`), with per-market implementations. First impl:
  **`UsSymbolUniverse`** over NASDAQ Trader. Future: `IndiaSymbolUniverse` (NSE),
  `JapanSymbolUniverse` (JPX).
- **Markets are additive, not either-or.** The **enabled** markets' universes
  **union** into one registry that search spans. `ENABLED_MARKETS` is a *set*
  (just `{US}` now) — this mirrors the adapter *pattern* of `MarketDataPort` but
  **not** its single-select model. A single watchlist can hold symbols from several
  markets at once; that's the design target even though only US ships now.
- **Canonical symbol identity = the yfinance-style id** (US: `AAPL`; NSE:
  `RELIANCE.NS`; Tokyo: `7203.T`). It's globally unique, so mixed-market symbols
  coexist in one watchlist **and resolve directly through the existing yfinance
  `MarketDataPort`** — no watchlist/data-model change. Each universe entry carries
  `{symbol, name, exchange, market}`.
- **Fetched once and cached centrally per market**, long TTL — the directory changes
  ~daily. One upstream fetch per market per TTL window across **all** users
  ([P5](../constitution.md)), not per client. (Substrate is an implementation choice —
  in-Lambda memory + TTL, a **gzipped** DynamoDB item, or S3; a raw ~10k-symbol
  universe is near DynamoDB's 400KB item cap, so compress or use S3 — see Open questions.)
- **`GET /v1/symbols/search?q=`** searches **all enabled markets** and returns ranked
  matches (`{symbol, name, exchange, market}`); an optional `&market=` *filters* (it
  does not select the one backend). Ranking (exact → prefix → name-substring) is a
  **pure function** over the composed list. The client debounces and gets small responses.
- Validation is authoritative server-side (membership in the composed universe).

## Options considered

### A. Client-side static file — rejected
Ship a committed `symbols.json` as a static asset; filter in-browser.
- ➕ Instant autocomplete (no per-keystroke round-trip); zero runtime backend.
- ➖ ~300KB downloaded by **every** browser; refresh = manual regen + commit +
  redeploy; not runtime-selectable per market (would ship multiple lists); duplicates
  a universe Phase 4 owns server-side anyway.

### B. Backend-owned universe + search endpoint — CHOSEN
- ➕ Fetched once centrally, cached, served to all — small per-query payloads, no
  per-client download.
- ➕ Consistent with the pure-core + adapters pattern ([P3](../constitution.md));
  the multi-market abstraction is the adapter boundary.
- ➕ Single source of truth shared with Phase 4; server-authoritative validation.
- ➖ More backend now (adapter + cache + endpoint + refresh); a network round-trip
  per keystroke (debounce + client cache mitigate); Lambda cold-start.

### C. Third-party symbol-search API — rejected
- ➖ Needless external dependency + per-request cost/limits; we already have free
  exchange directories.

## Consequences

- **Now:** build the `SymbolUniversePort` + `UsSymbolUniverse` (NASDAQ Trader), a
  registry that composes the *enabled* markets (just US today), the cached-universe
  load, the pure ranking function, and the `/v1/symbols/search` endpoint. Autocomplete
  (spec) consumes it; multi-ticker add (#2) validates against it. Build the
  set-of-markets shape now even though the set has one element — retrofitting an
  either-or design into an additive one later is the expensive path.
- **Refresh:** lazy long-TTL cache for v1 (first miss fetches + caches for all).
  A scheduled refresh folds into Phase 4's EventBridge batch later — same "precompute
  the universe" path ([ADR-0003](0003-discovery-engine.md)).
- **Multi-market (backlog #16):** adding India/Japan is a **new adapter added to the
  enabled set** — its symbols join the composed universe. Because watchlists store
  canonical (yfinance-style) ids, a user can already mix markets in one list with
  **no schema change**; only the universe/search becomes multi-market-aware.
- **Cost/latency:** per-market cached universe; per-keystroke search is a cache-hit
  read over the composed set, not an upstream fetch.

## Risk — constructed id vs. what yfinance actually uses

The exchange→suffix map is deterministic (Yahoo documents `.NS`/`.BO`/`.T`/`.L`/…),
but the **base symbol** can differ between the exchange feed and Yahoo, so a mechanical
"append the suffix" is not always right:
- Punctuation / class shares — **even US**: NASDAQ Trader `BRK.B` → Yahoo `BRK-B`.
- Preferreds / warrants / units / rights carry type suffixes that differ (and are junk
  for a screener anyway).
- Yahoo coverage gaps / aliases — some symbols don't resolve even with the correct id.
- Dual listings (`.NS` vs `.BO`) — same company, two valid ids.

**Mitigation (up-front, cheap):** each market adapter owns its **native→canonical
normalization** (e.g. US: class separators `.`/`/` → `-`) and the universe **filters
to common stock + ETF**, which drops the mismatch-prone types (warrants/units/rights/
preferreds) and handles the known punctuation cases. For US this is sufficient without
per-symbol checks.

**Verification is lazy, not a build-time sweep** — verifying all ~10k symbols against
yfinance would be thousands of rate-limited calls. Instead, resolution happens when a
symbol is actually **added/used** (it's fetched anyway); a symbol that returns no data
is flagged there, as it is today. Per-symbol pre-verification is only worth it for
international markets with messier feeds (#16), and even then sampled/scheduled.

This couples the canonical id to Yahoo's convention: swapping the data mechanism away
from yfinance would require remapping ids. Accepted (yfinance is the mechanism today).

## Open questions (for implementation)

- **Cache substrate + size.** A full US universe (~10k symbols × name+exchange) is
  ~400–500KB raw — at/over DynamoDB's 400KB single-item limit. Options: gzip into one
  item, in-Lambda memory + TTL (re-fetches per cold instance), or an S3 object. Lean
  in-memory + TTL for v1 simplicity; revisit if it needs to survive cold starts.
- Exact cache TTL for the universe (lean 24h).
- Whether `market` is a query param, a user preference, or derived — US-only for now,
  so a default suffices; revisit with #16.
