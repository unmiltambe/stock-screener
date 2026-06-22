# packages/view-logic

Framework-agnostic **presentation logic** shared across frontends: number/percent
formatting, the **red→yellow→green color thresholds**, and sort/rank helpers.

These are pure functions — the same on web and mobile. This is where the
threshold logic from the prototype's cell renderers lands, keeping it out of both
the API ([P1](../../docs/constitution.md)) and any single frontend's components
([P4](../../docs/constitution.md)).

**Rule:** pure functions only. No React, no DOM, no API calls.
