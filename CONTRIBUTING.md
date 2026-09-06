# Contributing to Nevo SpecDev

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
git switch main && git pull
git switch -c feature/short-slug        # or fix/ , docs/ , chore/
# ... work ...
pnpm check                              # the full local quality gate
git push -u origin feature/short-slug
gh pr create                            # Conventional Commits title; fill the template
```

`pnpm check` covers formatting, lint, documentation validation and index freshness, the
`version.json` transition gate, and every package's typecheck / test / build.
Prerequisites and the command reference:
[`docs/development/local-setup.md`](docs/development/local-setup.md).

To build and try the product CLI from a real tarball (not a workspace link):

```bash
pnpm product:pack        # -> .artifacts/nevo-specdev-<version>.tgz
pnpm dogfood:install     # pack + install globally + smoke `nevo-spec`
```

See [`docs/development/product-packaging.md`](docs/development/product-packaging.md) and
[`docs/development/dogfooding.md`](docs/development/dogfooding.md).

## Documentation changes

Every authored `.md` under `docs/` needs YAML frontmatter (`id`, `type`, `title`,
`status`, `read_when`, `summary`, optional `related`) — `pnpm docs:check` fails on a
file missing it; only `docs/templates/**` and generated files are exempt. Use the
templates in [`docs/templates/`](docs/templates/), or `pnpm docs:adr new "Title"` for a
new ADR. Run `pnpm docs:check --write` to refresh the generated index (it carries no
timestamp, so a no-op run produces no diff) and commit it with your change.

Keep the separation: engineering how-to in `docs/development/**`, product behaviour and
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
