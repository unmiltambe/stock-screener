# apps/mobile

**Placeholder — not built yet.** Reserved for a future React Native / Expo app.

Per [ADR-0002](../../docs/decisions/0002-web-mobile-sharing.md), the mobile app will
reuse the shared `packages/*` (types, API client, view logic) and implement its own
native screens — UI components are **not** shared with web.

Nothing here until roadmap Phase 5. This directory exists to make the sharing
boundary explicit from day one.
