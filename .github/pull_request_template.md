## What this does

## Why

Link the issue if there is one: Closes #

## Checklist
- [ ] `cd services && pytest` passes
- [ ] `cd apps/web && npm run build` passes (`tsc -b` + `vite build`)
- [ ] For UI changes: loaded the affected page locally and checked loading/empty/populated states
- [ ] Touches only what the task requires — no drive-by refactors ([CLAUDE.md](../CLAUDE.md))
- [ ] Decision recorded in an ADR/spec if this adds a dependency, an external service, or a user-facing choice ([CLAUDE.md §5](../CLAUDE.md))
- [ ] Backlog + reference docs updated if this completes/advances a tracked item or changes a documented surface (columns, ADR index) ([CLAUDE.md §4](../CLAUDE.md))
