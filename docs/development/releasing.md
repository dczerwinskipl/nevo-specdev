---
id: development.releasing
type: development
title: Releasing and version lines
status: current
read_when:
  - cutting a maintained release line
  - tagging a release or release candidate
  - understanding what version main and a release branch report
  - applying a hotfix to a released line
summary: >
  How the version model works in practice: version.json as durable metadata, CI-derived
  build versions, the cut-release-line workflow, tagging from release branches, and the
  0.x policy. The model itself is in architecture/repository-structure.md.
related:
  - architecture.repository-structure
  - adr.0003-branch-and-release-model
  - development.git-workflow
---

# Releasing and version lines

The model — `main` as the next development version, one long-lived `release/vX.Y` per
maintained minor line, explicit next-version choice — lives in
[repository-structure](../architecture/repository-structure.md#versioning-and-release-lines)
and ADR [0003](../architecture/decisions/0003-branch-and-release-model.md). This page
is the operational detail.

## Durable metadata: `version.json`

```jsonc
{
  "development": { "line": "0.1.0", "channel": "alpha" }, // what main represents
  "releaseLines": [], // one entry per maintained line, added when it's cut
}
```

It is **not** rewritten per change. Only a deliberate line bump or the release-cut flow
touches it.

## Derived build version

`scripts/release/version.mjs` (`pnpm version:print`) computes the full version from
`version.json` plus the CI environment:

| Where            | Version                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `main`, or local | `<line>-<channel>.<GITHUB_RUN_NUMBER>` — e.g. `0.1.0-alpha.42` (`0` locally)   |
| `release/vX.Y`   | the exact `version` recorded for that line — e.g. `0.1.0`, no prerelease stamp |

The build number is the run number: deterministic, never committed.
`--with-sha` appends `+<short-sha>` build metadata.

## Cutting a release line

Use the **`Cut release line`** workflow (Actions → Run workflow). Inputs:

| Input                      | Meaning                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `release_version`          | Version this line stabilizes, e.g. `0.1.0`.                                                            |
| `next_development_version` | Next line for `main` — **next minor** (`0.2.0`) or **next major** (`1.0.0`). Required; never inferred. |
| `from_sha`                 | Commit on `main` to cut from (default: current `origin/main`).                                         |
| `execute`                  | Unchecked = validate only. Checked = create the branch + open the PR.                                  |

With `execute`, the workflow:

1. validates both versions are plain SemVer and that the next is the adjacent minor or
   major of the release version;
2. confirms `release/vX.Y` does not already exist;
3. pushes `release/vX.Y` at the chosen `main` commit;
4. opens a PR (`chore/bump-main-to-<next>-alpha`) that sets
   `version.json#development.line` to the next line and appends the `releaseLines`
   entry.

### The main-bump PR and CI

`main` is protected, so the bump lands by PR like any other change. A PR opened with
the default `GITHUB_TOKEN` **does not trigger workflows**, so its required checks never
start and auto-merge cannot complete it. To fully automate:

- add a repository secret **`RELEASE_TOKEN`** — a fine-grained PAT with
  `contents: write` and `pull requests: write` on this repository. The workflow uses it
  for checkout and PR creation, CI then runs on the bump PR, and `--auto --squash`
  merges it when checks pass.

Without `RELEASE_TOKEN` the workflow still creates the release branch and opens the
bump PR; a maintainer merges that PR by hand once CI is green. Nothing is silently
skipped.

## Tagging a release

Tags come **only** from a `release/vX.Y` branch, never from an arbitrary `main` commit.

```bash
git switch release/v0.1 && git pull
git tag -a v0.1.0-rc.1 -m "v0.1.0-rc.1"    # release candidate
git tag -a v0.1.0      -m "v0.1.0"          # stable
git push origin v0.1.0
gh release create v0.1.0 --verify-tag --notes-from-tag
```

Package publication to npm is **out of scope** for now — a GitHub Release from the tag
is the release artifact.

## Hotfix on a released line

Full flow in [git-workflow](git-workflow.md#hotfix-on-a-released-line): branch
`fix/<slug>` off `release/vX.Y`, PR back into it (same review + CI gate, squash), tag
`vX.Y.(z+1)`, then forward-port to `main` and other maintained lines.

## 0.x policy

Pre-1.0, breaking changes are allowed without a major bump but must be intentional,
marked (`!` / `BREAKING CHANGE:`), and documented — see
[repository-structure](../architecture/repository-structure.md#0x-policy). `main`
still carries `0.y.0-alpha.<build>`. Release lines (`release/v0.y`) are cut only once
there is something to maintain separately from `main`.
