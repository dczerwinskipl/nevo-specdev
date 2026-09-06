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

## The operator flow (what to click)

Everything is a **Run workflow** in the Actions tab. To ship `stable 0.1.0`:

| #   | Action → run                    | On branch      | Effect                                                                |
| --- | ------------------------------- | -------------- | --------------------------------------------------------------------- |
| 1   | **Cut release line**            | `main`         | creates `release/v0.1` = `beta 0.1.0` + a PR moving `main` forward    |
| 2   | **Promote release** → `rc`      | `release/v0.1` | opens a PR setting `release/v0.1` to `rc 0.1.0`; merge after CI       |
| 3   | _(optional)_ **Release** → `rc` | `release/v0.1` | tags `v0.1.0-rc.N` + a GitHub Release (an optional publication point) |
| 4   | **Promote release** → `stable`  | `release/v0.1` | opens a PR setting `release/v0.1` to `stable 0.1.0`; merge after CI   |
| 5   | **Release** → `stable`          | `release/v0.1` | tags `v0.1.0` + a GitHub Release, then opens the next-patch PR        |

- **Promotion** changes `version.json` on the protected branch **only through a normal
  PR** — it never edits `release/vX.Y` directly and never tags anything.
- **Release** creates the Git tag + GitHub Release, and only after the branch HEAD has
  passed `quality` + `test` + `build`.
- A `stable` Release also opens the PR that advances the branch to the next patch's
  `beta`, so later builds never keep reporting the shipped version.
- Every workflow has a **validate-only** mode (leave `execute` unchecked): it runs all
  the real checks and reports what it _would_ do, changing nothing.
- Distributing an npm package / installing the CLI is out of scope here.

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
(`alpha` → `main`, any release channel → its `origin/release/vX.Y`, which must exist on
`origin`). There is no override flag.

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

`execute` unchecked = **validate-only**: every check below runs, nothing is changed —
a dry run that passes means the real run would proceed. It:

1. validates the versions (adjacent minor/major only);
2. `git fetch`, then **reads `origin/main`'s own `version.json` at the fetched base
   commit** (never the working tree) and refuses unless it is `channel: alpha` on
   exactly `release_version`, with `next_development_version` as that version's next
   minor or major. A PR-list query failure fails closed (not read as "no PR");
3. **recognises a prior run only by CONTENT, never by branch/PR name.** An existing
   `release/vX.Y` is accepted only when read-only Git inspection shows it is a single
   commit changing **only** `version.json` to `beta <release_version>`, on a base whose
   `version.json` is `alpha <release_version>` **and** which is a real ancestor of
   `origin/main` (`git merge-base --is-ancestor`) — an unrelated commit that merely
   carries the right `version.json` is rejected. When a bump PR is open, its head
   branch **must** exist and structurally match (mirror on the same base) — the PR URL
   alone is never evidence. A merged bump PR (`origin/main` already on `alpha <next>`)
   is recognised as fully complete. Any inconsistency → fail closed, never overwritten,
   never force-pushed;
4. execute: creates `release/vX.Y` at `origin/main` **plus one commit setting that
   branch's `version.json` to `beta <release_version>`** and pushes
   `chore/bump-main-to-<next>` (`alpha <next_development_version>`). Both commits are
   built with git plumbing — the workflow's working tree is never touched.

### Landing the main-bump PR

A PR opened by the default `GITHUB_TOKEN` does **not** trigger `pull_request`
workflows, so its required checks never start.

- **With `CI_GITHUB_RELEASE_TOKEN`**: the workflow opens the PR and requests
  squash auto-merge; CI runs and it lands on its own. If the repository does not
  have auto-merge enabled, the tool says so and the PR simply waits for a normal
  merge after CI. An auth / permission / network failure of the auto-merge request is
  **not** swallowed — it surfaces.
- **Without `CI_GITHUB_RELEASE_TOKEN`**: the workflow pushes the branch and prints the
  exact `gh pr create …` command. Run it **yourself** — a PR you open triggers CI.

Nothing is described as "merge manually" when the required checks could never turn
green.

### `CI_GITHUB_RELEASE_TOKEN`

A repository secret: a **fine-grained GitHub PAT scoped to this repository only**. It is
used solely so a release/promote workflow can open a PR whose `pull_request` CI must
run (the built-in `GITHUB_TOKEN` cannot trigger that). Every operation that works with
the built-in token still falls back to `github.token`; only PR creation is handed off
when the PAT is absent.

Minimum permissions for the operations the tool actually performs (push a branch by
plumbing, open a PR, request auto-merge, tag + GitHub Release on the `Release`
workflow):

| Permission    | Level        | Why                                                         |
| ------------- | ------------ | ----------------------------------------------------------- |
| Contents      | Read & write | push the promotion / bump / advance branch; tags + Releases |
| Pull requests | Read & write | open the PR, request auto-merge                             |
| Workflows     | Read         | (only if a PR ever touches `.github/workflows/`)            |
| Metadata      | Read         | mandatory for every fine-grained PAT                        |

No token value is ever stored in the repository. If the secret is unset, the workflows
still run and hand off PR creation safely.

### Why branch creation is allowed on a protected pattern

`release/v*` is protected, but the `required_status_checks` rule is set with
`do_not_enforce_on_create: true`: the single creating push (which cannot go through a PR
and cannot have CI results) is allowed; every later push is fully gated. Deletion stays
blocked. Verified against the live ruleset. To remove a mistaken release branch, an
admin sets the ruleset's `enforcement` to `disabled`, deletes it, and re-runs
`nevo-repo-github configure`.

## Promoting

Run **`Promote release`** from a `release/vX.Y` branch (pick the branch in GitHub's
Run-workflow selector).

| Input     | Meaning                                                         |
| --------- | --------------------------------------------------------------- |
| `target`  | `rc` (from `beta`) or `stable` (from `rc`)                      |
| `execute` | Unchecked = **validate-only**: run every check, change nothing. |

Promotion **never touches `release/vX.Y` directly and never tags anything.** It:

1. fetches; requires the current branch to be `release/vX.Y`; requires local HEAD ==
   `origin/<branch>`; reads `version.json` from `origin/<branch>`;
2. validates the immediate transition against the shared domain rule
   (`beta → rc`, `rc → stable` only — `beta → stable` is rejected; a branch already at
   `stable` is told to run `Release stable`, which prepares the next patch);
3. is **recovery-safe by structure, never by name** — an existing
   `chore/promote-<version>-to-<target>` branch (with or without an open PR) is reused
   only if read-only Git inspection proves it is a single commit on the current
   `origin/<branch>` HEAD changing only `version.json` to exactly `{ target, version }`.
   An open PR whose head branch is missing or invalid → fail closed. `origin/<branch>`
   already in the target channel → "already promoted";
4. execute: builds one commit by git plumbing (no working tree touched), pushes
   `chore/promote-<version>-to-<target>`, and opens / hands off a PR back to
   `release/vX.Y` (title `chore(release): promote <version> to <target>`), requesting
   auto-merge when `CI_GITHUB_RELEASE_TOKEN` is set.

After the promotion PR merges, run **`Release`** to cut the `<target>` tag.

## Releasing

Run **`Release`** from a `release/vX.Y` branch:

| Input     | Meaning                                                               |
| --------- | --------------------------------------------------------------------- |
| `channel` | `beta` \| `rc` \| `stable`                                            |
| `execute` | Unchecked = **validate-only**: run every check below, change nothing. |

**Validate-only is real validation, not a rubber stamp.** It runs every read-only
check the execute path runs and answers _"would this succeed right now?"_ — it just
never creates a commit / branch / tag / Release / PR / auto-merge. A dry run that
"passes" means the real run would proceed.

The checks, in order (all performed in both modes):

1. **local checkout is current** — after `git fetch`, the release-branch local HEAD
   must equal `origin/<release branch>`. A behind or diverged checkout is refused
   (`git pull --ff-only` and retry); an unresolvable `origin/<branch>` fails closed.
   The release always tags the current remote protected-branch commit.
2. branch / version-in-line / channel (**promote first** if the channel does not match);
3. **the release-branch HEAD passed CI** — `quality`, `test` and `build` check-runs
   must all be `success` on that commit (not `pr-title`, which is PR-only). A
   freshly-cut branch, a red commit, or an unreadable check-run response is refused;
4. tag selection: `beta` / `rc` → the next number in that channel's sequence from the
   existing tags; `stable` → `v1.3.0`;
5. **recovery-safe**: the target tag already on HEAD with its Release → nothing; on
   HEAD without a Release → create just the missing Release; pointing elsewhere →
   refuse loudly; an orphaned last prerelease tag on HEAD is completed, never skipped
   to `-beta.2`. If the GitHub Release state cannot be **determined** (auth, network,
   404-vs-outage ambiguity), the run fails closed rather than assuming "absent".
6. execute: create the annotated tag + a GitHub Release (`--prerelease` for beta/rc,
   generated notes). **No npm package is published.**

The tag + Release (step 6) and the stable branch-advance below are **independent
idempotent steps**: a re-run after "tag done, advance failed" still performs the
advance — it is not skipped just because the tag is already complete.

### After a stable tag

A `stable` release also ensures the branch moves to
`{ channel: "beta", version: "<next patch>" }`, so later commits report
`X.Y.(Z+1)-beta.<n>` — never the already-shipped `X.Y.Z`. The advance branch
(`chore/advance-release-vX.Y-to-X.Y.(Z+1)`) is **reused only when it structurally
matches** the intended operation: read-only Git inspection must show it is a single
commit on the current `origin/release/vX.Y` HEAD that changes **only** `version.json`,
to exactly the expected next state. An advance branch with an extra file, a wrong base,
or wrong content is **refused** — never force-pushed, never turned into a PR. An open
advance PR whose head branch is missing or does not structurally match is a fail-closed
error; the PR URL alone is never taken as evidence. (Same
`CI_GITHUB_RELEASE_TOKEN` / manual-`gh pr create` rule as above.)

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
