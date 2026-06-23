# ADR-0004 — Stable resource identifiers (and API versioning)

- **Status:** Accepted (provisional)
- **Date:** 2026-06-22
- **Deciders:** Project owner
- **Relates to:** [requirements §2](../requirements.md), [design §3/§5](../design.md), [constitution P1](../constitution.md)

## Context

The first API keyed watchlists by their `name` in the path
(`/watchlists/Big Tech`). Names are **user-editable**, can **collide**, and aren't
**URL-safe** — so renaming a watchlist changed its own URL, and names with spaces
or slashes needed escaping. That conflicts with the REST expectation that a
resource has one stable identifier.

The question: which entities get a minted **surrogate id**, and which keep a
**natural key**?

## Decision

**Mint a stable opaque id only for entities whose natural key is user-editable or
otherwise mutable/ambiguous.** Everything else uses its natural or externally
issued key.

| Entity | Identifier | Surrogate id? | Rationale |
|--------|-----------|---------------|-----------|
| **Watchlist** | minted `id` (uuid4 hex) | ✅ yes | `name` is mutable, collidable, not URL-safe. `name` becomes an attribute. |
| **Ticker / symbol** | the symbol (`AAPL`) | ❌ no | Immutable, unique, URL-safe, and the key every market-data provider uses. A surrogate would break interop. |
| **User** | Cognito `sub` | ➖ external | Already a stable opaque id, issued by Cognito. We consume the claim. |
| **Score cache** | `CACHE#<sym>` | ❌ no | Keyed by symbol. |
| **Universe snapshot** | `UNIVERSE#<asOf>` | ❌ no | `asOf` timestamp is a stable snapshot id; rows keyed by symbol. |

**Consequence for watchlists:** identity is decoupled from name, so **names need
not be unique** per user. We keep a soft uniqueness hint in the UI but do not
enforce it as an invariant.

**Forward rule:** future user-named entities (saved screens/filters, alerts,
dashboards) follow the watchlist pattern — surrogate id + `name` attribute.
Tickers and snapshots never get surrogate ids.

## API versioning (decided alongside)

All data endpoints are served under a **`/v1` path prefix**; `/health` stays
unversioned. A path prefix (vs. a header) is the simplest scheme to route, cache,
and reason about, and lets a future `/v2` coexist during migration. Introduced now,
before any frontend couples to the contract, because retrofitting a version is
disruptive.

Also adopted: **`PATCH` carries a partial representation of the resource**
(`{ "name": "..." }`) rather than a bespoke `{ "newName": "..." }` field.

## Consequences

- `WatchlistRepo` is keyed by `watchlist_id`; `create` mints and returns the id;
  `rename` mutates the `name` attribute and **preserves the id** (URLs are stable
  across rename).
- DynamoDB watchlist item becomes `SK = WL#<id>` with `name` as an attribute
  ([design §5](../design.md)).
- The web client references watchlists by id and treats `name` as display text.
- Slugging names (e.g. `big-tech`) was rejected: a slug derived from a mutable name
  isn't stable across rename, defeating the purpose.
