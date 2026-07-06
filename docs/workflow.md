# Workflow — change → verify → document → ship

**The single go-to checklist for making a change and getting it live**, for agents
and humans. It sequences the whole lifecycle and links out to the authoritative
detail docs (it does not duplicate them). Every item here exists because we *missed*
it at least once — treat the checkboxes as load-bearing, not decorative.

> Detail docs: [AGENTS.md](../AGENTS.md) (how to work + guardrails) ·
> [constitution.md](constitution.md) (P1–P10) ·
> [deploy-aws.md](deploy-aws.md) (deploy runbook) · [local-dev.md](local-dev.md)
> (run locally).

---

## 0. Before you start

- [ ] Identify the **roadmap phase** this belongs to; don't pull later-phase work forward ([roadmap.md](roadmap.md)).
- [ ] Check the change against **P1–P10** ([constitution.md](constitution.md)). If it must break one → ADR.
- [ ] **Decide if it needs an ADR or spec _now_, not after** — the four triggers (external dependency, data off-platform, user-facing feature with alternatives, lasting tradeoffs) are in [AGENTS.md §5](../AGENTS.md); they're independent of the P-check.
- [ ] Branch: small fix → off `main`; larger work → a feature branch tied to an issue.
- [ ] Search before writing new components/helpers — extract shared, don't copy ([P9](constitution.md)).

## 1. While coding

- [ ] Minimum code that solves it; nothing speculative ([AGENTS.md §2](../AGENTS.md)).
- [ ] Surgical — touch only what the task needs; match surrounding conventions.
- [ ] Backend stays pure/isolated ([P3](constitution.md)); no presentation in the API ([P1](constitution.md)); no UI imports in `packages/*` ([P4](constitution.md)).
- [ ] Every query-backed view renders for **loading / empty / guest / auth / error** ([P10](constitution.md)).

## 2. Verify — typecheck is NOT verification

- [ ] Backend: `cd services && pytest` (add tests for the change).
- [ ] Frontend: `cd apps/web && npm run build` — **`tsc -b` + `vite build`**, not `tsc --noEmit` (which has passed while the app was broken).
- [ ] **Load the affected page in a browser** and exercise loading/empty/populated states. Use the preview panel (`.claude/launch.json` starts `api` + `web`); verify with real data, don't assume.

## 3. Document — "done" includes the paper trail

The single biggest source of misses. A shipped change whose docs still say "planned"
is **not done** ([AGENTS.md §4](../AGENTS.md)).

- [ ] **Backlog** ([backlog.md](backlog.md)): mark the item ✅ done / ◑ partial, link the ADR/spec, record what was deferred — in the prioritized list **and** the item body.
- [ ] **ADR / spec**: written (or updated) if §0 flagged one. ADRs in [decisions/](decisions/), specs in [specs/](specs/).
- [ ] **Reference docs your change touched** — a doc claiming "every X" is stale the moment you add one:
  - added/changed a **table column** → [ui-columns.md](ui-columns.md) (definition, color, tooltip, sort) **and** the column-order diagram;
  - added/changed a **screen, route, nav element, or a screen's data/actions/layout** → [screens.md](screens.md) (the affected S-entry — status/data/actions — and the nav-shell section);
  - added an **ADR/spec/doc** → [docs/README.md](README.md) index;
  - changed a **user-facing feature list, prereq, or setup step** → root [README.md](../README.md).
- [ ] Voice check on any user-facing copy ([voice.md](voice.md)).

## 4. Commit

- [ ] Group into **logical commits** (feature vs docs vs config), not one blob.
- [ ] Brief bullet-point messages, no prose.
- [ ] Never commit secrets (`.env`, credentials) — `.gitignore` blocks them; double-check the diff.
- [ ] Merge to `main` (`--no-ff` to keep the feature grouped). Push only on owner sign-off.

## 5. Deploy to AWS

> All deploys go through [`deploy.sh`](../services/deploy/aws/deploy.sh), which
> encodes the footguns (secret preserved + never echoed, Cognito callback pinned,
> diff forced before apply). Runbook + rationale: [deploy-aws.md](deploy-aws.md).

- [ ] **Frontend-only or full-stack?** A change touching `services/app/**` needs `deploy.sh backend` **first**, then `frontend` — a frontend-only deploy of a full-stack feature renders against the *old* API (fields come back `null`).
- [ ] `deploy.sh diff` — review: for a code ship, the **only** change is the Lambda image URI; Cognito callbacks must not appear. Docker daemon running (`colima start`).
- [ ] `deploy.sh backend` and/or `deploy.sh frontend`.

## 6. Post-deploy verification

- [ ] `deploy.sh smoke` — health, Cognito callbacks intact, fresh-ticker fields present (popular tickers can serve **stale rows up to 15 min** — the script uses an uncommon symbol).
- [ ] Load the live app; confirm the change is visible and correct.

---

## Session-miss ledger (why each item above exists)

| Miss | Now caught by |
|------|---------------|
| Backlog not updated when a feature shipped | §3 backlog checkbox; [AGENTS.md §4](../AGENTS.md) |
| ADR/spec written only when asked, not proactively | §0 ADR/spec trigger; [AGENTS.md §5](../AGENTS.md) |
| `ui-columns.md` / docs index left stale after adding a column/ADR | §3 reference-docs checkbox |
| `screens.md` updated only because the owner prompted a docs sweep (landing ship) — no checklist trigger named it | §3 screens.md checkbox |
| Deployed frontend only for a change with backend fields | §5 frontend-only-or-full-stack |
| Blind `cdk deploy` would have dropped the prod Cognito callback | §5 `cdk diff` first + pinned `frontend_url`; [AGENTS.md](../AGENTS.md) |
| Verifying with `tsc`/build only, not the running app | §2 browser verify |
| Post-deploy "it's null" confusion (stale score cache) | §6 fresh-ticker check + TTL note |
