# Contributing to Nevo SpecDev

Thanks for your interest. This repository is at an early, foundational stage — most
work right now is repository infrastructure, not product features.

## Ground rules

- **No direct commits to `main` or `release/v*`.** All changes go through a pull
  request. See [`docs/development/git-workflow.md`](docs/development/git-workflow.md).
- **Squash merge only.** The **PR title** becomes the commit message and must follow
  [Conventional Commits](docs/development/commit-conventions.md). Checkpoint commits on
  your branch can be informal.
- **Keep changes reviewable.** One coherent change per PR; no unrelated diffs.
- Review conversations must be resolved and required CI checks green before merge.

## Local workflow

```bash
corepack enable
pnpm install
git switch -c feature/short-slug        # or fix/ , docs/ , chore/
# ... work ...
pnpm check                              # format:check + lint + typecheck + test + build
pnpm docs:check                         # if you touched docs/
git push -u origin feature/short-slug
gh pr create                            # set a Conventional Commits title; fill the template
```

Prerequisites and the full command set: [`docs/development/local-setup.md`](docs/development/local-setup.md).

## Documentation changes

Every indexed doc under `docs/` carries YAML frontmatter (`id`, `type`, `title`,
`status`, `read_when`, `summary`, optional `related`). Use the templates in
[`docs/templates/`](docs/templates/). Run `pnpm docs:check --write` to refresh the
generated index and commit it with your change. CI runs `pnpm docs:check`.

Keep the separation: engineering how-to in `docs/development/**`, product behavior and
personas in `docs/product/**`, durable decisions in `docs/architecture/**`.

## Decisions

If your change alters something recorded in
[`docs/architecture/decisions/`](docs/architecture/decisions/), update or supersede the
ADR in the same PR.

## License of contributions

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).

## Security

Do not open a public issue for a vulnerability — see [`SECURITY.md`](SECURITY.md).
