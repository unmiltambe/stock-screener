# apps/web

The web frontend — **React + Vite + TypeScript** SPA. The only frontend built now.

Consumes the shared packages (`packages/shared-types`, `packages/api-client`,
`packages/view-logic`) and talks to the backend API ([docs/design.md §3](../../docs/design.md)).
Authenticates via Cognito (Hosted UI to start).

Responsibilities: rendering watchlists, leaderboards, charts, comments, and the
screener/suggestions UI. All presentation logic (colors, formatting) comes from
`packages/view-logic` — see [P1](../../docs/constitution.md).

_Scaffolding lands in roadmap Phase 3._
