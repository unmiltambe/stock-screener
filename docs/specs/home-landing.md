# Spec — New-user landing page (backlog #17)

> **Status:** design frozen, implementation not started. Branch `feat/home-landing`.
> Depends on **[#18 curated starter watchlist](../backlog.md)** for the built-in
> views + live hero to look compelling on arrival.

The home page today is a bare "Watchlists" heading — it tells a first-time visitor
nothing about *what* Bellwether does or *who* it's for. This replaces it, **for
signed-out visitors**, with a marketing landing that carries a deliberate narrative;
signed-in users keep a clean dashboard with no marketing chrome.

## Goals

- A signed-out visitor understands, in one glance, **who it's for** and **what it
  does**, then sees **how** and **why it's different** — enough to try it.
- The hero shows the **real product working**, not a screenshot that rots.
- Zero new backend for the landing itself (the seed list, #18, is separate).

## Non-goals

- No change to the scoring model, chart data, or API surface.
- No SEO/SSR work (the SPA stays client-rendered for now).
- Not a pricing/about/marketing-site build — one page, in-app.

## Audience & narrative

Target user: the **self-directed retail investor** juggling several tools to track
and evaluate the stocks they follow. The page is a single argument, top to bottom,
mapped to the four beats the PM/marketing lenses called for:

| # | Section | Beat | Job |
|---|---------|------|-----|
| 1 | **Hero** | ① audience · ③ solution | Eyebrow "For the self-directed investor" + tagline "Read the signal, not the noise" + a **live** chart-and-scored-table panel |
| 2 | **Pain** | ② pain points | Four DIY-research frustrations: scattered tools, numbers without meaning, manual comparison, always stale |
| 3 | **How it works** | ③ solution | Three animated loops — **Understand** (score + tooltip math) → **Visualize** (chart + SMA 50/200) → **Act** (leaderboard) |
| 4 | **Differentiation** | ④ differentiation | Transparent scoring · fundamentals+technicals combined · leaderboard ranks for you · zero-friction guest access. Muted "instead of…" tags |
| 5 | **Live proof** | ③ solution | Built-in All Symbols + Leaderboard, alive on first visit thanks to the seed (#18) |
| 6 | **Final CTA** | — | "Open my starter list" |

Copy follows [voice.md](../voice.md) — market-literate warmth, brief, no hype.

## Design decisions (frozen)

**D1 — Routing: signed-out landing, signed-in dashboard.**
`/` renders the landing for signed-out visitors and the dashboard (today's
`WatchlistsPage`) for signed-in users. Guests are the default no-login state, so the
hero's **"Start free"** bootstraps a guest session and routes into the app — it does
*not* require sign-in. Rejected: inlining the hero into `WatchlistsPage` (couples
marketing to the dashboard, no clean signed-in view) and a separate `/welcome` route
(an extra hop; `/` is the natural landing).

**D2 — The hero is the real component, reused, not a screenshot.**
The hero panel embeds the existing `ChartPanel` + `TickerTable` (read-only/showcase
mode) fed by live data, so it can never go stale. Rejected: a static PNG (rots as the
UI evolves; lies about current scores).

**D3 — Column-configurable table (`columns` prop).**
`TickerTable` today hardcodes ~18 columns across three grouped headers
([TickerTable.tsx:407–444](../../apps/web/src/features/watchlists/TickerTable.tsx)).
Refactor to a **column registry** keyed by id, each def carrying
`{ id, group, label, tip, accessor, renderCell, className }`; head and row iterate a
`columns: ColumnId[]` prop (defaulting to the full set — existing callers unchanged).
The landing passes the subset `["ticker", "fundamental", "technical", "overall",
"signal"]`; the grouped header row derives from the visible columns' groups (on the
subset, only the Scores group survives, so it collapses cleanly). One generic
component, two views — no duplication. This directly answers the "control columns via
init params so the core stays generic" ask.

**D4 — Full-word score labels are canonical, site-wide.**
Already true in the live table (`Fundamental` / `Technical` / `Overall`,
[TickerTable.tsx:437–439](../../apps/web/src/features/watchlists/TickerTable.tsx)); the
registry keeps these as the single source of truth so the landing and dashboard never
drift. No abbreviations for the score columns anywhere.

**D5 — "How it works" is Understand → Visualize → Act; "Add" dropped.**
Autocomplete is table-stakes and was over-weighted; the arc now leads with the
differentiators. Each step is a short **muted autoplay-loop `<video>` (webm)** recorded
from the live app — preferred over true GIF (≈10× smaller, full-color, crisper). Step 2
(Visualize) replaces the old Add step.

**D6 — Differentiation section retained.** Four cards; contrast lines are muted gray
"instead of…" (not green — green reads as positive on a statement about the inferior
alternative).

**D7 — Charts light-themed.** Hero + step-2 charts use the app's light theme (white
surface, real line colors: price `accent`, SMA-50 `warn`, SMA-200 `pos`), always with
the SMA legend. No dark-background chart panels on the landing.

**D8 — Depends on #18 (curated seed).** The live hero, All Symbols, and Leaderboard
are only compelling if a new guest's starter list is diverse. #18 (backend seed
change) is a prerequisite for the "live proof" section to impress.

## Component & data architecture

```
apps/web/src/features/landing/
  LandingPage.tsx        composes the six sections; gated in App.tsx on auth state
  Hero.tsx               live ChartPanel + TickerTable(columns=subset) in a framed panel
  PainSection.tsx        four pain cards (static)
  HowItWorks.tsx         three <video> loops + captions
  Differentiation.tsx    four "why" cards with muted contrast tags
  LiveProof.tsx          links into All Symbols + Leaderboard
  media/                 captured webm loops (understand.webm, visualize.webm, act.webm)
```

- **Routing (`App.tsx`):** at `/`, branch on auth — signed-in → `WatchlistsPage`
  (dashboard); signed-out → `LandingPage`. "Start free" triggers guest bootstrap then
  navigates to the dashboard.
- **Table refactor (`TickerTable.tsx`):** column registry + `columns` prop (D3). Keep
  `extraCell`/`extraGroupHeader`/`extraHeader` slots working.
- **Hero data:** reuse `useWatchlist`/`useAllSymbols` hooks against the visitor's
  seeded starter list (#18). If a public showcase list is preferred over per-guest
  data, that's a small read-only endpoint — deferred unless #18's timing forces it.

## Media / loops plan

Capture three ~2–4s loops from the running app via the preview browser:
1. **Understand** — cursor glides to a score cell → tooltip opens with the breakdown.
2. **Visualize** — chart period animates 1M → 1Y as the SMA lines redraw.
3. **Act** — leaderboard rows fill in by rank.

Export muted, `loop`, `autoplay`, `playsinline` webm; provide a poster frame for
first paint. Keep each under ~300 KB. Re-capture when the UI changes materially.

## Open questions

- **Hero data source:** per-guest seeded list vs. a fixed public showcase list.
  Lean per-guest (no new endpoint); revisit if landing must render pre-bootstrap.
- **Reduced-motion:** honor `prefers-reduced-motion` — show the poster frame, no
  autoplay ([P10](../constitution.md) spirit).

## Build plan / task list

1. **Table column registry** — refactor `TickerTable` to a column-def registry +
   `columns` prop; default = full set. Verify dashboard + All Symbols render
   identically (browser, not just build). *(largest task; touches a shared component)*
2. **Routing gate** — `App.tsx` branch at `/` on auth state; "Start free" → guest
   bootstrap → dashboard.
3. **Landing scaffold** — `LandingPage` + the six section components with frozen copy.
4. **Hero** — embed live `ChartPanel` + `TickerTable(columns=subset)`; light theme.
5. **Pain / Differentiation / Live proof** — static sections per the mockup.
6. **How-it-works loops** — capture 3 webm loops from the live app; wire `<video>` +
   posters + reduced-motion.
7. **Seed (#18)** — land the curated starter list (separate PR/commit) so the built-in
   views look alive.
8. **Verify** — `npm run build`, then load `/` signed-out (landing) and signed-in
   (dashboard); exercise loading/empty/error; check reduced-motion.

## Verification

- `cd apps/web && npm run build` green (`tsc -b` + `vite build`).
- Signed-out `/` renders the landing; signed-in `/` renders the dashboard.
- Dashboard + All Symbols columns unchanged after the table refactor.
- Hero chart/table show live data and update on row select.
- Loops autoplay muted; poster shown under `prefers-reduced-motion`.
- [ui-columns.md](../ui-columns.md) updated if any column label/behavior changed.
