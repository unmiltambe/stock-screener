# Contributing

Thanks for taking an interest in the project. This is a personal side project,
so process is intentionally light — but a few things make contributions easier
to review and merge.

## Before you start

- For anything beyond a small fix, open an issue first to align on approach —
  saves rework on both sides.
- Read [CLAUDE.md](CLAUDE.md) and [docs/constitution.md](docs/constitution.md)
  (principles P1–P10) before larger changes. Architecture decisions here are
  deliberate, not accidental — PRs that go against a principle should say why in
  the description.
- [docs/backlog.md](docs/backlog.md) and [docs/roadmap.md](docs/roadmap.md) have
  the current plan; check there before proposing new work so it's not duplicated
  or out of sequence.

## Making a change

1. Fork or branch, make the change. For a small fix, branch directly off `main`
   and open the PR when ready. For a larger addition, open a feature branch tied
   to the issue you opened above — keeps in-progress work isolated and makes
   the PR easier to review as one coherent change.
2. Match existing conventions in the file you're touching — surgical changes
   over drive-by refactors.
3. Run the checks before opening a PR:
   ```bash
   # backend
   cd services && source .venv/bin/activate && pytest

   # frontend
   cd apps/web && npm run build   # tsc -b, then vite build — both must pass
   ```
4. Open a PR against `main`. CI runs the same checks; a review is required
   before merge.

## Licensing

This project is [MIT licensed](LICENSE). By submitting a pull request, you
agree that your contribution is licensed under the same MIT license as the
rest of the project.
