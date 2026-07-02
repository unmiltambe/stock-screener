# ADR-0010 — In-app feedback channel (report a bug / request a feature)

**Status:** accepted  
**Date:** 2026-07-02

## Context

We're opening the app up beyond the author — first to a handful of friends, then
publicly ([roadmap.md](../roadmap.md), going-public work). The point of doing that
early is to **get real feedback while the product is still cheap to change**, so we
want an always-available "report a bug / request a feature" affordance in the app
now, not later.

The constraint that drove the decision: our users skew **non-technical**, and the
app already gives everyone a **zero-friction guest session** on first visit
([ADR-0009](0009-guest-session-before-login.md)) — nobody has to log in to use it.
A feedback channel that reintroduces a login/signup wall would contradict that and
suppress exactly the casual feedback we're trying to collect.

[backlog.md](../backlog.md) #15 scoped three tiers of effort; this ADR records
which we chose and why.

## Decision

**Embed a [Tally](https://tally.so) form as an in-app popup**, triggered from an
unobtrusive "Report a bug / request a feature" link in the footer.

### How it works

- One script tag in [`apps/web/index.html`](../../apps/web/index.html):
  `<script async src="https://tally.so/widgets/embed.js"></script>`.
- The footer trigger is a `<button>` carrying Tally's data-attributes
  (`data-tally-open="<formId>"`, `data-tally-layout="modal"`, a width). Tally's
  embed script delegates the click and opens the form as a modal *over* the app —
  no redirect, no React/JS wiring, no TypeScript typing shims.
- The Tally form itself (fields, form ID) is created in the Tally dashboard — a
  one-time setup step outside the codebase. The form ID is the only value the code
  needs.

### Where feedback lands / notifications

- Responses are stored on **Tally's servers** (EU-hosted) and read in the Tally
  dashboard. Tally can additionally notify by email or fan out to Slack/Discord/
  Google Sheets/webhook — configured in the dashboard, no app code.

### Abuse prevention

- Handled by Tally (built-in CAPTCHA / spam controls, rate limiting). No app-side
  work, because submissions never touch our backend.

## Consequences

**Good:**
- **Login-free for everyone** — friends submit without a GitHub account and without
  even signing into our site (they're already a guest). This is the whole point.
- **No backend, no new npm dependency** — one script tag + a few data-attributes.
- Looks clean and stays *in* the app (modal), not a jarring off-site redirect.
- Ships in minutes once the form exists — feedback starts flowing immediately.

**Trade-offs:**
- **Third-party dependency.** Feedback data lives on Tally (off-platform), and a
  third-party script loads on every page (minor perf/privacy cost; won't function
  on `localhost` without network). Accepted for a low-sensitivity friend-feedback
  channel; noted so it's a conscious choice, not drift.
- Removing Tally's own small branding requires their paid tier.
- "Free forever" is not guaranteed by any SaaS — so we keep the integration thin
  (one script tag + one form ID) to make migrating off it trivial.

## Alternatives considered

**GitHub issue link** (`/issues/new/choose`, reusing the
[`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE) files). Near-zero effort
and abuse/notifications are free via GitHub. **Rejected as the primary channel**
because filing a GitHub issue *requires a logged-in GitHub account* — there is no
anonymous filing, and our site's guest session does not carry over to GitHub. That
wall blocks the non-technical friends whose feedback we most want. (Still fine as a
secondary channel for technical contributors once the repo is public.)

**Custom in-app form → backend** (`POST /v1/feedback` → DynamoDB → Slack/Discord
webhook or SES, tied to the existing guest/JWT session). The most frictionless
*and* fully on-platform option — but real backend work plus its own abuse controls
(rate limiting, Turnstile/honeypot, sanitization). **Deferred, not rejected:** the
intended upgrade path if/when the third-party dependency becomes unwanted or the
feedback volume justifies owning it. Tally now buys us the same login-free UX for
a fraction of the effort.

**Google Forms.** Same login-free, no-backend properties as Tally, but visibly
dated UI and no clean in-app embed. Rejected on polish.

**`mailto:` link.** Zero dependency and works before the repo is public, but
unstructured, exposes an address to scrapers, and depends on the visitor having a
mail client configured. Rejected.

## Follow-ups

- Create the Tally form and wire its form ID into the footer button.
- Revisit the custom in-app form (above) if Tally's terms change, feedback volume
  grows, or we want feedback to live on our own stack — it also composes with
  #14 usage analytics.
