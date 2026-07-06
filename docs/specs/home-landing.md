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

**D3 — Hero uses a lightweight showcase table, not a refactor of the shared one.**
The landing hero needs a **5-column** view (`Ticker · Fundamental · Technical ·
Overall · Signal`). The shared `TickerTable` hardcodes ~18 columns four times over
(`BASE_ACCESSORS`, `TIPS`, the `<td>` row, the `<Th>` head) plus a two-row grouped
header with `colSpan`s (5/5/4/4) and group `border-left` separators
([TickerTable.tsx:396–445](../../apps/web/src/features/watchlists/TickerTable.tsx)).

*Rejected — full column registry / `columns` prop.* Making the head/row iterate a
column list means computing the grouped-header `colSpan`s and border boundaries from
the visible set — the fiddly, bug-prone part — inside the single table that renders
both busiest pages (watchlist detail + All Symbols, each with `extraCell`/
`extraGroupHeader`/`extraHeader` injections). `tsc`/`vite build` can't catch a wrong
`colSpan`, misaligned column, or broken sort ([CLAUDE.md §4](../../CLAUDE.md)), so it
carries real regression risk on the most-used screens for a one-panel need — the
speculative generality [P2/§2](../../CLAUDE.md) warns against, with no second caller
yet.

*Chosen — a small `ShowcaseScoreTable` (~40–50 lines)* rendering only the 5 columns,
no groups, no sort, no expandable chart row. It **reuses the same live data**
(`TickerRow` via the same hooks — so it's real, never a stale screenshot, satisfying
D2) **and the same `lib/format` color/formatter helpers** (`scoreColor`,
`signalColor`, `fmtNum`) — so scoring/label logic is not duplicated, only the compact
layout differs. Zero changes to the shared `TickerTable`, hence zero regression risk
to the dashboard.

*Future option:* if a second real caller needs configurable columns (e.g. a trimmed
mobile view in Phase 5), revisit the registry then — build the abstraction when the
second use case is concrete, not before.

**D4 — Full-word score labels are canonical, site-wide.**
Already true in the live table (`Fundamental` / `Technical` / `Overall`,
[TickerTable.tsx:437–439](../../apps/web/src/features/watchlists/TickerTable.tsx)); the
showcase table hardcodes the same three labels. No abbreviations for the score columns
anywhere.

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
  LandingPage.tsx          composes the six sections; gated in App.tsx on auth state
  Hero.tsx                 live ChartPanel + ShowcaseScoreTable in a framed panel
  ShowcaseScoreTable.tsx   compact 5-col live table (reuses TickerRow + lib/format)
  PainSection.tsx          four pain cards (static)
  HowItWorks.tsx           three <video> loops + captions
  Differentiation.tsx      four "why" cards with muted contrast tags
  LiveProof.tsx            links into All Symbols + Leaderboard
  media/                   captured webm loops (understand.webm, visualize.webm, act.webm)
```

- **Routing (`App.tsx`):** at `/`, branch on auth — signed-in → `WatchlistsPage`
  (dashboard); signed-out → `LandingPage`. "Start free" triggers guest bootstrap then
  navigates to the dashboard.
- **Showcase table (`ShowcaseScoreTable.tsx`):** new ~40–50-line presentational
  component rendering 5 columns from `TickerRow`, reusing `scoreColor`/`signalColor`/
  `fmtNum` from `lib/format` (D3). No change to the shared `TickerTable`.
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

1. ✅ **Showcase table** — `ShowcaseScoreTable` (5 cols) reusing `TickerRow` +
   `lib/format`. No change to the shared `TickerTable`.
2. ✅ **Routing gate** — `App.tsx` branch at `/` on auth state; "Start free" →
   session-scoped `entered` flag → dashboard.
3. ✅ **Landing scaffold** — `LandingPage` + the six sections with frozen copy.
4. ✅ **Hero** — live `ChartPanel` + `ShowcaseScoreTable`, light theme, row-click
   drives the chart.
5. ✅ **Pain / Differentiation / Live proof** — static sections per the mockup.
6. ◑ **How-it-works visuals** — crisp static JSX panels shipped as stand-ins
   (`UnderstandVisual`/`VisualizeVisual`/`ActVisual`). **Still to do:** capture the
   webm loops + `prefers-reduced-motion` handling.
7. ✅ **Seed (#18)** — curated "Starter picks" list landed; seeding tests green.
8. ◑ **Verify** — `npm run build` green; browser-verified landing (live data,
   row-click), Start free → dashboard, dashboard table + chart panel unchanged. Still
   to check: reduced-motion once loops land; deploy smoke.

## Verification

- `cd apps/web && npm run build` green (`tsc -b` + `vite build`).
- Signed-out `/` renders the landing; signed-in `/` renders the dashboard.
- Dashboard + All Symbols unchanged (the shared `TickerTable` isn't touched).
- Hero chart/table show live data and update on row select.
- Loops autoplay muted; poster shown under `prefers-reduced-motion`.
- [ui-columns.md](../ui-columns.md) updated if any column label/behavior changed.
