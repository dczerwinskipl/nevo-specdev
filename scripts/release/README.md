# `scripts/release/`

Version-line tooling. The durable metadata is [`version.json`](../../version.json) at
the repository root; nothing here rewrites it except a deliberate line bump or the
release-cut flow.

## `version.mjs` — derive the build version

```bash
pnpm version:print                 # from version.json + $GITHUB_* (0 build locally)
node scripts/release/version.mjs --with-sha
```

- On `main` (or locally): `<development.line>-<development.channel>.<GITHUB_RUN_NUMBER>`,
  e.g. `0.1.0-alpha.42`. `--with-sha` appends `+<short-sha>` build metadata.
- On `release/vX.Y`: the exact `version` recorded for that line in `version.json` — no
  prerelease stamp.

The build number comes from the CI run number, so it is deterministic and never
committed. Pure functions (`deriveVersion`, `parseSemverCore`, `releaseBranchFor`) are
covered by `version.test.mjs` (`pnpm test:scripts`).

## `cut-release-line.mjs` — start a maintained line

```bash
node scripts/release/cut-release-line.mjs \
  --release-version 0.1.0 --next-development-version 0.2.0 [--check | --execute] [--from <sha>]
```

`--next-development-version` is **required** and must be the next minor
(`0.2.0`) **or** the next major (`1.0.0`) of the release version — the tool refuses to
guess. `--check` (default) validates and confirms `release/v0.1` does not already
exist. `--execute` creates `release/v0.1` from `origin/main` and opens the PR that
moves `version.json#development.line` to the next line.

Prefer the [`cut-release-line`](../../.github/workflows/cut-release-line.yml) workflow
(`workflow_dispatch`) over running this locally. See
[`docs/development/releasing.md`](../../docs/development/releasing.md) for the full flow,
tag steps, and the `RELEASE_TOKEN` requirement for auto-merging the main-bump PR.
