# Workflow — change → verify → document → ship

**The single go-to checklist for making a change and getting it live**, for agents
and humans. It sequences the whole lifecycle and links out to the authoritative
detail docs (it does not duplicate them). Every item here exists because we *missed*
it at least once — treat the checkboxes as load-bearing, not decorative.

> Detail docs: [CLAUDE.md](../CLAUDE.md) (how to work) · [AGENTS.md](../AGENTS.md)
> (guardrails) · [constitution.md](constitution.md) (P1–P10) ·
> [deploy-aws.md](deploy-aws.md) (deploy runbook) · [local-dev.md](local-dev.md)
> (run locally).

---

## 0. Before you start

- [ ] Identify the **roadmap phase** this belongs to; don't pull later-phase work forward ([roadmap.md](roadmap.md)).
- [ ] Check the change against **P1–P10** ([constitution.md](constitution.md)). If it must break one → ADR.
- [ ] **Decide if it needs an ADR or spec _now_, not after** ([CLAUDE.md §5](../CLAUDE.md)). Triggers, independent of the P-check:
  - introduces an external/third-party dependency, or sends user data off-platform;
  - a user-facing feature with more than one reasonable approach;
  - a choice among alternatives with real, lasting tradeoffs.
  - ADR = decision + rationale + rejected alternatives · spec = plan for a bigger feature.
- [ ] Branch: small fix → off `main`; larger work → a feature branch tied to an issue.
- [ ] Search before writing new components/helpers — extract shared, don't copy ([P9](constitution.md)).

## 1. While coding

- [ ] Minimum code that solves it; nothing speculative ([CLAUDE.md §2](../CLAUDE.md)).
- [ ] Surgical — touch only what the task needs; match surrounding conventions.
- [ ] Backend stays pure/isolated ([P3](constitution.md)); no presentation in the API ([P1](constitution.md)); no UI imports in `packages/*` ([P4](constitution.md)).
- [ ] Every query-backed view renders for **loading / empty / guest / auth / error** ([P10](constitution.md)).

## 2. Verify — typecheck is NOT verification

- [ ] Backend: `cd services && pytest` (add tests for the change).
- [ ] Frontend: `cd apps/web && npm run build` — **`tsc -b` + `vite build`**, not `tsc --noEmit` (which has passed while the app was broken).
- [ ] **Load the affected page in a browser** and exercise loading/empty/populated states. Use the preview panel (`.claude/launch.json` starts `api` + `web`); verify with real data, don't assume.

## 3. Document — "done" includes the paper trail

The single biggest source of misses. A shipped change whose docs still say "planned"
is **not done** ([CLAUDE.md §4](../CLAUDE.md)).

- [ ] **Backlog** ([backlog.md](backlog.md)): mark the item ✅ done / ◑ partial, link the ADR/spec, record what was deferred — in the prioritized list **and** the item body.
- [ ] **ADR / spec**: written (or updated) if §0 flagged one. ADRs in [decisions/](decisions/), specs in [specs/](specs/).
- [ ] **Reference docs your change touched** — a doc claiming "every X" is stale the moment you add one:
  - added/changed a **table column** → [ui-columns.md](ui-columns.md) (definition, color, tooltip, sort) **and** the column-order diagram;
  - added an **ADR/spec/doc** → [docs/README.md](README.md) index;
  - changed a **user-facing feature list, prereq, or setup step** → root [README.md](../README.md).
- [ ] Voice check on any user-facing copy ([voice.md](voice.md)).

## 4. Commit

- [ ] Group into **logical commits** (feature vs docs vs config), not one blob.
- [ ] Brief bullet-point messages, no prose.
- [ ] Never commit secrets (`.env`, credentials) — `.gitignore` blocks them; double-check the diff.
- [ ] Merge to `main` (`--no-ff` to keep the feature grouped). Push only on owner sign-off.

## 5. Deploy to AWS

> Full runbook + exact commands: [deploy-aws.md](deploy-aws.md). The rules below are
> the ones we've been bitten by.

- [ ] **Frontend-only or full-stack?** A change touching `services/app/**` (models, adapters, schemas, api) needs the **backend (Lambda via `cdk deploy`)**, not just the S3 sync. A frontend-only S3 deploy of a full-stack feature ships a UI that renders against the *old* API (fields come back `null`). Deploy **backend first**, then frontend.
- [ ] **Backend — never blind-apply.** `cdk diff` first; confirm the **only** change is the intended one (for a code ship, the `AWS::Lambda::Function` image URI). Two context values silently revert live state if omitted:
  - `basic_auth_pass` (secret) — read from the live Lambda into a shell var, **never echo it**; omitting resets the `/ui` password.
  - `frontend_url` — now pinned in [cdk.json](../services/deploy/aws/cdk/cdk.json) `context`; omitting used to drop the prod Cognito callback → **broken sign-in**. Only override for a brand-new distribution.
  - Docker daemon must be running (container-image Lambda).
- [ ] **Frontend:** `npm run build` → `aws s3 sync dist/ s3://<FrontendBucket>/ --delete` → CloudFront invalidation `--paths '/*'`.

## 6. Post-deploy verification

- [ ] `curl <FrontendUrl>/health` → `{"status":"ok"}`; live `index.html` references the **new** bundle hash; invalidation `Completed`.
- [ ] **Fresh-ticker API check** — `curl -H "X-Guest-Id: $(uuidgen)" '<FrontendUrl>/v1/scores?tickers=WSO'` returns the fields your change shipped. Popular tickers can serve **stale rows for up to 15 min** (score-cache TTL) — use an uncommon symbol for an immediate read.
- [ ] **Cognito callbacks intact** — `describe-user-pool-client … --query CallbackURLs` still contains `https://<dist>.cloudfront.net/callback`.
- [ ] Load the live app; confirm the change is visible and correct.

---

## Session-miss ledger (why each item above exists)

| Miss | Now caught by |
|------|---------------|
| Backlog not updated when a feature shipped | §3 backlog checkbox; [CLAUDE.md §4](../CLAUDE.md) |
| ADR/spec written only when asked, not proactively | §0 ADR/spec trigger; [CLAUDE.md §5](../CLAUDE.md) |
| `ui-columns.md` / docs index left stale after adding a column/ADR | §3 reference-docs checkbox |
| Deployed frontend only for a change with backend fields | §5 frontend-only-or-full-stack |
| Blind `cdk deploy` would have dropped the prod Cognito callback | §5 `cdk diff` first + pinned `frontend_url`; [AGENTS.md](../AGENTS.md) |
| Verifying with `tsc`/build only, not the running app | §2 browser verify |
| Post-deploy "it's null" confusion (stale score cache) | §6 fresh-ticker check + TTL note |
