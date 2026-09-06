# `nevo-repo-release`

Repository-internal release tooling. Private, unnpm-published, and never a
`nevo-spec` product surface (ADR 0005). The full flow is in
[`docs/development/releasing.md`](../../docs/development/releasing.md).

`version.json` at the repository root is `{ channel, version }` for whichever branch it
is on. SemVer parsing/compare is the `semver` package; only the channel/branch rules
are custom.

## `bin/version.mjs` — `pnpm version:print`

```bash
pnpm version:print               # from version.json + $GITHUB_* (run number 0 locally)
```

- `alpha` / `beta` / `rc` → `<version>-<channel>.<run>` (e.g. `1.3.0-beta.147`).
- `stable` → `<version>`.
- a tag ref → its own version; any other tag ref is an error.

## `bin/check-version-transition.mjs` — `pnpm version:check-transition`

CI + local gate. A change to `version.json` must be a legal transition (unchanged /
main-line bump / line cut / promotion) — otherwise it fails.

The rules are checked against the **target** branch (the release state machine being
mutated), never the head branch a PR is raised from: a PR into `main` is checked as
`main`, a PR into `release/v1.3` as `release/v1.3`. Base/target is taken from
`GITHUB_BASE_REF` (a PR), the pushed branch with `HEAD~1` (a branch push), or — for a
local run — inferred from the working-tree `version.json` (`alpha` → `main`, any
release channel → its `origin/release/vX.Y`). `BASE_REF` overrides all of this.

## `bin/cut-release-line.mjs`

```bash
node tools/release/bin/cut-release-line.mjs \
  --release-version 1.3.0 --next-development-version 1.4.0 [--execute]
```

Always cuts from the current `origin/main`. Inputs also come from `RELEASE_VERSION` /
`NEXT_DEVELOPMENT_VERSION` / `EXECUTE` so the workflow passes no user input on the
command line. Without `--execute`: validate only. With it: create `release/vX.Y` (with
its `version.json`), push the main-bump branch, and either open the bump PR
(`RELEASE_TOKEN_PRESENT=true`) or print the exact `gh pr create` command.

## `bin/release.mjs`

```bash
node tools/release/bin/release.mjs --channel beta|rc|stable [--execute]
```

Run on a `release/vX.Y` branch. Validates branch / version-in-line / channel, then
**requires the branch HEAD to have passed `quality` + `test` + `build`** on GitHub
before tagging. Recovery-safe: a re-run after "tag created, Release failed" finishes the
Release; a tag pointing elsewhere is refused. After a `stable` tag it opens the PR that
advances the branch to the next patch's `beta`. No npm publish.

## Layout

```
tools/release/
  src/    version.mjs · cut-release-line.mjs · release.mjs · index.mjs   (typechecked, tested)
  bin/    thin CLI wrappers
  test/   node:test suites (pure planners)
```

`node --test test/*.test.mjs` runs via `turbo run test` (affected-aware).
