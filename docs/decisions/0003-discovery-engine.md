# ADR-0003 — Discovery engine: scheduled batch over a defined universe

- **Status:** Proposed (frames the new direction; data-source sub-decision deferred)
- **Date:** 2026-06-21
- **Deciders:** Project owner
- **Relates to:** [requirements §6](../requirements.md), [design §6](../design.md), [SCORING.md](../SCORING.md)

## Context

The product is expanding from "score the tickers I follow" to "**find and suggest
stocks I don't follow**, ranked by factors." This is a fundamentally different
data-volume problem:

- Watchlist scoring touches **tens** of tickers — fine to fetch on demand and cache.
- Discovery must rank a **universe of hundreds to thousands** of tickers. Fetching
  that per user request is impossible: free providers (yfinance `.info`) rate-limit
  hard (the prototype was already 401'd by ~60 sequential calls), and the latency
  would be minutes.

So the core question: **how and when is the universe scored, and where do rankings
live?**

## Options considered

### A. Score the universe live, per request
- ➖ Infeasible: rate limits + multi-minute latency + cost. Rejected outright.

### B. Scheduled batch precompute → query precomputed rankings (CHOSEN)
A scheduled job (EventBridge → Lambda) scores the whole universe periodically
(target: daily, off-hours), writes a ranked snapshot to DynamoDB, and flips a
"latest" pointer. User screen/suggest requests query that snapshot.

- ➕ User requests are fast and independent of universe size (NFR-2.3).
- ➕ Respects provider limits — one throttled batch instead of N user-driven storms ([P5](../constitution.md)).
- ➕ Scales to zero — the batch is periodic and cheap ([P7](../constitution.md)).
- ➕ Reuses the **same** `/services/core` scoring as the request path; no duplicate logic.
- ➖ Rankings are as fresh as the last batch (daily) — acceptable; this is not a day-trading tool.
- ➖ Introduces a new component (scheduler + batch Lambda) and a universe-snapshot data model.

### C. Continuous/streaming scoring
- ➖ Massive overkill for daily-relevant fundamentals; cost and complexity unjustified.

## Decision

**Adopt Option B: a scheduled batch precompute.** Rankings are written to a
`UNIVERSE#<asOf>` partition in DynamoDB and served via `/screen` and `/suggestions`
from the latest snapshot (see [design §5–6](../design.md)).

## Deferred sub-decisions (each may become its own ADR)

1. **Data source & universe size.** Start small and prove the pipeline — e.g. the
   **S&P 500** via throttled yfinance. Expanding to thousands of names will likely
   require a **bulk fundamentals provider** (e.g. FMP, Tiingo, EOD) with a real API
   contract and cost. Decide when the small universe is working end-to-end.
2. **Sector-aware scoring (FR-6.6).** [SCORING.md](../SCORING.md) caveats mean a
   naive ranking would surface banks, ETFs, utilities, and pre-profit names
   misleadingly. Minimum viable handling: **suppress/flag** unreliable categories
   (ETFs, financials) in discovery. Better: sector-relative normalisation. Decide
   the mechanism before exposing suggestions broadly.
3. **Refresh cadence & snapshot retention.** Daily to start; keep N recent snapshots
   for diffing ("new this week"), prune the rest in the batch job.

## Consequences

- A new `/services/discovery` module owns the **universe definition** and the batch
  entrypoint; it depends on `/services/core` + adapters, nothing UI.
- The data model gains `UNIVERSE#<asOf>` ranking items and a `UNIVERSE/LATEST`
  pointer ([design §5](../design.md)).
- "Suggestions" (FR-6.4) is a cheap query: latest universe ranking **minus** the
  user's existing tickers — combining global precompute with per-user data.
- Until the data-source sub-decision is made, the universe is intentionally small
  (S&P 500) so the architecture can be validated without a paid provider.
