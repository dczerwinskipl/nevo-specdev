---
id: development.releasing
type: development
title: Releasing and version lines
status: current
read_when:
  - understanding what version main or a release branch reports
  - cutting a maintained release line
  - promoting a release branch (beta -> rc -> stable) or starting a patch
  - tagging a beta / rc / stable release
  - applying a hotfix to a released line
summary: >
  The version model (version.json = channel + version), CI-derived build versions, the
  legal-transition gate, the cut-release-line and release workflows, the
  beta -> rc -> stable channel flow with an automatic post-stable advance, intentional
  prerelease tag sequences, and the pre-1.0 policy.
related:
  - architecture.repository-structure
  - adr.0003-branch-and-release-model
  - development.git-workflow
  - development.ci
---

# Releasing and version lines

The tooling is the private `nevo-repo-release` package under
[`tools/release/`](../../tools/release/README.md).

## `version.json`

Every branch carries `version.json = { channel, version }` (`version` is a plain
`X.Y.Z`):

| Branch         | `channel`                                                | `version`                    |
| -------------- | -------------------------------------------------------- | ---------------------------- |
| `main`         | `alpha`                                                  | the next development `X.Y.0` |
| `release/vX.Y` | `beta` → `rc` → `stable` → (`beta` of the next patch, …) | the `X.Y.Z` being stabilized |

It changes only through the workflows and PRs below. **CI enforces the legal
transitions** (`pnpm version:check-transition`): a PR or push that edits `version.json`
must be one of

- unchanged;
- a **main-line bump** — `alpha` stays `alpha`, version steps to the next minor or
  major `.0`;
- a **line cut** — `alpha X.Y.0` → `beta X.Y.0` on the matching `release/vX.Y`;
- a **promotion** — `beta→rc`, `rc→stable`, or `stable→beta|rc` of the next patch.

Anything else fails CI. The check is always evaluated against the **branch the change
targets** — the PR base, or the branch a push lands on — so a promotion PR is judged
by `release/vX.Y`'s rules no matter what the source branch is called. A local
`pnpm version:check-transition` infers the target from `version.json` itself
(`alpha` → `main`, any release channel → its `origin/release/vX.Y`); set `BASE_REF` to
override.

## CI build version

`pnpm version:print` derives the build version from `version.json` + the CI
environment:

| Situation                                    | Build version                                                     |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `channel: alpha` / `beta` / `rc`             | `<version>-<channel>.<GITHUB_RUN_NUMBER>` — e.g. `1.3.0-beta.147` |
| `channel: stable`                            | `<version>` — e.g. `1.3.0`                                        |
| ref is a tag `refs/tags/vX.Y.Z[-beta\|rc.N]` | that exact version — never re-derived                             |

The run number is a **build identifier**, not a release number.

## Cutting a release line

Run **`Cut release line`** (Actions → Run workflow). It always cuts from the **current
`origin/main`** — there is no historical "from" input.

| Input                      | Meaning                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `release_version`          | The version this line stabilizes, e.g. `1.3.0`.                                                        |
| `next_development_version` | Next line for `main` — **next minor** (`1.4.0`) or **next major** (`2.0.0`). Required; never inferred. |
| `execute`                  | Unchecked = validate only. Checked = act.                                                              |

With `execute` it:

1. validates the versions (adjacent minor/major only);
2. fails closed if the remote is unreachable, and reports (does not silently resume) a
   half-finished previous run;
3. creates `release/vX.Y` at `origin/main` **plus one commit setting that branch's
   `version.json` to `{ "channel": "beta", "version": "<release_version>" }`** — so the
   branch's first CI run has a valid version;
4. pushes `chore/bump-main-to-<next>`, a branch that sets `main`'s `version.json` to
   `{ "channel": "alpha", "version": "<next_development_version>" }`.

### Landing the main-bump PR

A PR opened by the default `GITHUB_TOKEN` does **not** trigger `pull_request`
workflows, so its required checks never start.

- **With `RELEASE_TOKEN`** (a fine-grained PAT with `contents: write` +
  `pull requests: write` set as a repository secret): the workflow opens the PR and
  requests auto-merge; CI runs and it lands on its own.
- **Without `RELEASE_TOKEN`**: the workflow pushes the bump branch and prints the exact
  `gh pr create …` command. Run it **yourself** — a PR you open triggers CI normally.

Nothing is described as "merge manually" when the required checks could never turn
green.

### Why branch creation is allowed on a protected pattern

`release/v*` is protected, but the `required_status_checks` rule is set with
`do_not_enforce_on_create: true`: the single creating push (which cannot go through a PR
and cannot have CI results) is allowed; every later push is fully gated. Deletion stays
blocked. Verified against the live ruleset. To remove a mistaken release branch, an
admin sets the ruleset's `enforcement` to `disabled`, deletes it, and re-runs
`configure-repository.mjs`.

## Promoting and releasing

Promotion is a one-line `version.json` edit on the release branch, via a PR:
`beta→rc`, `rc→stable`, or (once a patch shipped) `stable→beta|rc` of the next patch.
`tools/release` exports `planPromotion` for the legal transitions; CI's transition gate
rejects the rest.

Run **`Release`** from a `release/vX.Y` branch:

| Input     | Meaning                    |
| --------- | -------------------------- |
| `channel` | `beta` \| `rc` \| `stable` |
| `execute` | Unchecked = validate only. |

It validates the branch, that `version.json`'s version is on that line, and that its
channel equals the requested one (**promote first** otherwise). Then:

1. **verifies the release-branch HEAD passed CI** — `quality`, `test` and `build`
   check-runs must all be `success` on that commit (not `pr-title`, which is PR-only).
   A freshly-cut branch or a red commit is refused;
2. computes the tag:
   - `beta` / `rc` → the next number in that channel's sequence from the existing tags
     (`v1.3.0-beta.1`, `-beta.2`, `-rc.1`, …);
   - `stable` → `v1.3.0` (refused if it exists);
3. **recovery-safe execution**: if the tag already exists and points at the same HEAD,
   it only creates the missing GitHub Release (or does nothing if both exist); if it
   points elsewhere, it refuses loudly. It never bumps `-beta.2` just because
   `-beta.1`'s tag exists without a Release;
4. creates the annotated tag + a GitHub Release (`--prerelease` for beta/rc, generated
   notes). **No npm package is published.**

### After a stable tag

A `stable` release also opens a PR moving the branch to
`{ channel: "beta", version: "<next patch>" }`, so later commits report
`X.Y.(Z+1)-beta.<n>` — never the already-shipped `X.Y.Z`. (Same `RELEASE_TOKEN` /
manual-`gh pr create` rule as above.)

## Hotfix on a released line

Branch `fix/<slug>` off `release/vX.Y`, PR back into it (same review + CI gate, squash),
then promote (`stable→rc` or `stable→beta`) and release: optionally `v1.3.1-rc.1`, then
`v1.3.1`. Forward-port the fix to `main` and other maintained lines with their own PRs.

## Pre-1.0 policy

Before `1.0.0`, breaking changes are allowed without a major bump, but must be
intentional, marked (`!` / `BREAKING CHANGE:`), and documented — see
[repository-structure](../architecture/repository-structure.md#0x-policy). `main`
carries `0.y.0-alpha.<build>`; release lines (`release/v0.y`) are cut only once there is
something to maintain separately.
