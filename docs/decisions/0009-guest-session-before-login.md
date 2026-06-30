# ADR-0009 — Guest session before login (try before you sign up)

**Status:** accepted  
**Date:** 2026-06-29

## Context

Forcing login on first visit is a known conversion killer. New users don't know
whether the product is worth their time; a signup wall answers that question by
making them leave. The alternative — a read-only "demo mode" — is weaker because
the user can't form a habit without ownership over their own data.

We want users to be able to try every feature (create watchlists, add tickers,
see scores) with zero friction, and only be asked to sign in when they have
something worth saving.

## Decision

**Auto-create an ephemeral guest session on first visit.** The full app is
available immediately. A subtle persistent banner offers to sign in and save the
session permanently. On sign-in, guest data migrates to the Cognito user account.

### How it works

**Client (frontend):**
- On first load, if no Cognito token exists, generate a UUID v4 and store in
  `sessionStorage` as `guestId`.
- Every API call includes `X-Guest-Id: <uuid>` instead of an `Authorization` header.
- After Cognito login, call `POST /v1/auth/migrate-guest` with the guest ID, then
  clear `sessionStorage` and switch to Bearer token auth.

**Server (backend `api/auth.py`):**
- `deps.get_user_id` already returns a string user ID from either JWT or header.
- Add a third path: if no Bearer token and `X-Guest-Id` header present → return
  `GUEST#<uuid>` as the user ID.
- The rest of the app is completely unaware of the distinction.

**Storage:**
- Guest DynamoDB items include a `ttl` attribute set to `now + 7 days` (epoch
  seconds). DynamoDB's TTL feature auto-deletes them — no cleanup job needed.
- Authenticated user items have no TTL.

**Migration endpoint (`POST /v1/auth/migrate-guest`):**
- Authenticated (Bearer JWT required).
- Body: `{ "guest_id": "<uuid>" }`.
- Copies all watchlists from `GUEST#<uuid>` → `USER#<sub>`, then deletes the
  guest items. Idempotent (safe to call twice).
- Only called once, right after Cognito redirect.

### Sign-in nudge (not a gate)

The header always shows a "Sign in" link (or user avatar when authenticated).
A secondary nudge appears in the watchlist index after the user has created
something worth saving — "Sign in to keep your lists forever." No modal, no
interrupt, no timer.

## Consequences

**Good:**
- Zero friction for new users; full feature access immediately.
- Guest data is real data (same code path) — no fake "demo mode" to maintain.
- 7-day TTL means no storage accumulation from abandoned sessions.
- The migrate path makes the conversion moment feel low-stakes.

**Trade-offs:**
- Backend must handle `GUEST#` prefix in user IDs without leaking between sessions
  (the UUID provides enough entropy; collision probability is negligible).
- Migration logic adds one endpoint and ~30 lines of service code.
- If a user opens the app in two different browsers before signing in, they get
  two independent guest sessions (acceptable — they haven't signed in yet).

## Alternatives considered

**Read-only demo user (shared):** All guests see the same curated watchlist.
Rejected — guests can't create their own lists, so there's no ownership, no
habit, and no reason to convert.

**Login wall:** Gate everything behind Cognito. Rejected — high bounce rate for
new visitors; incompatible with this decision.

**localStorage persistence (client-side only):** Store guest data in the browser,
sync to server on login. Rejected — complex conflict resolution, breaks on
private browsing, and guest data isn't available on the server for scoring
(yfinance / DynamoDB lookups still need a server-side user identity).
