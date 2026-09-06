# `scripts/release/`

Version derivation and release tooling. The full model is in
[`docs/development/releasing.md`](../../docs/development/releasing.md).

`version.json` (repository root) is `{ channel, version }` for whichever branch it is
on. Nothing here rewrites it except `cut-release-line` (which sets the new branch's
copy) and a deliberate promotion PR.

## `version.mjs` — derive the build version

```bash
pnpm version:print               # from version.json + $GITHUB_* (run number 0 locally)
node scripts/release/version.mjs --with-sha
```

- `alpha` / `beta` / `rc` → `<version>-<channel>.<run>` (e.g. `1.3.0-beta.147`).
- `stable` → `<version>` (e.g. `1.3.0`).
- a tag ref (`refs/tags/vX.Y.Z[-beta|rc.N]`) → that exact version; any other tag ref is
  an error (never re-derived as an alpha build).

Pure, tested functions: `deriveBuildVersion`, `nextPrereleaseTag` (the intentional
`-beta.N` / `-rc.N` sequence), `planPromotion` (legal channel transitions),
`parseSemverCore`, `lineOfBranch`, `versionInLine`.

## `cut-release-line.mjs` — start a maintained line

```bash
node scripts/release/cut-release-line.mjs \
  --release-version 1.3.0 --next-development-version 1.4.0 [--from <ref>] [--execute]
```

Inputs may also come from the environment (`RELEASE_VERSION`,
`NEXT_DEVELOPMENT_VERSION`, `FROM_REF`, `EXECUTE`) so the workflow never interpolates
user input into a shell command. `--next-development-version` is required and must be
the adjacent next minor **or** next major — never inferred.

Without `--execute`: validates and prints the plan. With `--execute`: creates
`release/vX.Y` (with its own `version.json` set to `beta`) and opens the
`chore/bump-main-to-<next>` PR. Fails closed if the remote is unreachable; a
half-finished previous run is reported, not silently resumed.

## `release.mjs` — tag + GitHub Release

```bash
node scripts/release/release.mjs --channel beta|rc|stable [--execute]
```

Run on a `release/vX.Y` branch. Validates the branch, that `version.json`'s version
belongs to the line, and that its channel matches the request. Computes the next tag
(`v1.3.0-beta.2`, `v1.3.0-rc.1`, `v1.3.0`, …), then — with `--execute` — creates the
annotated tag and a GitHub Release (`--prerelease` for beta/rc). **No npm publish.**

Prefer the [`Release`](../../.github/workflows/release.yml) and
[`Cut release line`](../../.github/workflows/cut-release-line.yml) workflows over
running these locally.
