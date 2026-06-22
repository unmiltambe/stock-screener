# ADR-0001 — Backend & overall stack: React SPA + Python Lambda

- **Status:** Accepted (provisional — no code written yet)
- **Date:** 2026-06-21
- **Deciders:** Project owner
- **Context:** [constitution.md](../constitution.md), [requirements.md](../requirements.md)

## Context

The predecessor (Bellwether) was a single-user Streamlit app: an always-on Python
process, local JSON files, no auth. The new product needs **multiple users with
private watchlists**, a **discovery engine over a broad universe**, **lowest
possible running cost**, and an architecture that is **extensible and maintainable**
— explicitly avoiding the framework friction already hit with Streamlit (row-click
handling, iframe sizing, CSS overrides).

The owner's strengths are server-side/native (C/C++/Python/Java); frontend is new
ground — making "keep the backend in Python" a meaningful tie-breaker.

Two hard constraints shape the choice:
1. **Per-user persistence** — rules out anything where the filesystem resets unless
   paired with a real database.
2. **Aggressive upstream rate limits** — demands a shared cache + batch precompute
   regardless of compute choice ([P5](../constitution.md)).

## Options considered

### A. Keep Streamlit, add auth + DB (EC2/Lightsail)
- ➕ Smallest delta; reuses existing UI; stays in Python.
- ➖ Always-on compute → pays for idle (~$10–15/mo), violates [P7](../constitution.md).
- ➖ Streamlit owns app structure (re-runs top-to-bottom per interaction); multi-user state is awkward and the friction worsens.
- ➖ Weak path to mobile.
- **Verdict:** best effort-to-multi-user ratio, worst long-term fit. A stopgap, not a destination.

### B. React SPA + Python Lambda (CHOSEN)
React + TS on S3/CloudFront; FastAPI-on-Lambda behind API Gateway; Cognito;
DynamoDB; EventBridge-scheduled discovery batch.

- ➕ **Scales to zero** — pay per request, ~$2–5/mo at low usage ([P7](../constitution.md)).
- ➕ **Backend stays Python** — scoring moves over unchanged ([P3](../constitution.md)); only the frontend is a new language.
- ➕ Clean layer separation; independently testable/upgradeable — serves "maintainable & extensible."
- ➕ API-first ([P1](../constitution.md)) → future mobile is a frontend-only effort ([ADR-0002](0002-web-mobile-sharing.md)).
- ➕ Batch discovery fits naturally (EventBridge + Lambda), reusing the same core.
- ➖ Most up-front work: new frontend in an unfamiliar language + AWS toolchain.
- ➖ Lambda cold starts add latency (acceptable for cached/batch data).
- ➖ More moving parts than a single VM (mitigated by IaC, [P6](../constitution.md)).

### C. FastAPI + HTMX on a container/VM
- ➕ Entirely Python, gentle curve, API-capable backend.
- ➖ Server renders HTML → tension with strict [P1](../constitution.md); a mobile client couldn't reuse the HTMX UI, only the JSON (needs a parallel JSON API anyway).
- ➖ Rich charts/tables strain HTMX — exactly our UI.
- ➖ Container/VM → not truly scale-to-zero without extra work.
- **Verdict:** strongest "stay in Python end-to-end" option and a viable Plan B; weaker on rich UI and mobile reuse.

### D. Next.js full-stack + Python microservice
- ➕ One framework for frontend + API routes; great DX.
- ➖ Splits the backend across TS (routes) and Python (scoring) — two backend languages, more seams.
- ➖ Best-fit hosting (Vercel) is off-AWS; AWS-native path is heavier.
- **Verdict:** good for TS-first teams; the language split works against this owner's Python strength.

## Decision

**Adopt Option B.** It is the only option that satisfies *scale-to-zero cost* +
*Python backend* + *API-first (mobile-ready)* + *clean maintainability* +
*natural fit for a scheduled discovery batch* simultaneously. Options **A** and
**C** are recorded fallbacks: A if multi-user is needed in a weekend; C if the
React curve proves too costly and rich charting can be simplified.

## Consequences

- The owner takes on a frontend learning curve (JS/TS, React, CSS, AWS frontend
  toolchain). Mitigated by TypeScript (familiar type discipline) and Cognito Hosted
  UI (avoids hand-building auth screens).
- The pure scoring logic becomes `/services/core` — the most stable part of the
  system, reused by both the request path and the discovery batch.
- We accept Lambda cold-start latency and higher part-count for near-zero idle cost
  and managed operations.
