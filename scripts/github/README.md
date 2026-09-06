# `scripts/github/`

Idempotent administration of this repository's GitHub settings through the
authenticated [`gh`](https://cli.github.com/) CLI.

> A checked-in JSON file does not configure GitHub by itself. The source of truth is
> GitHub's actual settings. [`repository-policy.json`](repository-policy.json) is the
> desired state; [`configure-repository.mjs`](configure-repository.mjs) reconciles
> GitHub to it and verifies the result.

## Usage

```bash
node scripts/github/configure-repository.mjs --check   # report drift, change nothing
node scripts/github/configure-repository.mjs           # apply, then verify
```

Requires `gh` authenticated as a repository **admin**. The script detects the repo from
the checkout, contains no secrets, matches rulesets by name (safe to re-run), prints
what it changed, and exits non-zero on verification failure or (`--check`) any drift.

## What it configures

**Merge settings**: squash-only (merge commits and rebase merges disabled), auto-delete
head branches, auto-merge allowed, squash commit title/body taken from the PR.

**Rulesets** `protected-main` (`refs/heads/main`) and `protected-release-lines`
(`refs/heads/release/v*`), identical rules:

| Rule                      | Effect                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `deletion`                | branch cannot be deleted                                                                                |
| `non_fast_forward`        | no force-push                                                                                           |
| `required_linear_history` | linear history                                                                                          |
| `pull_request`            | PR required; squash-only; review threads resolved; stale approvals dismissed; (see review policy below) |
| `required_status_checks`  | strict; `pr-title`, `quality`, `test`, `build`; **`do_not_enforce_on_create: true`**                    |

No bypass actors.

### `do_not_enforce_on_create`

`cut-release-line` creates `release/vX.Y` by pushing a commit directly (there is no PR
that can bring a branch into existence, and no CI can have run on a branch that does not
exist yet). `do_not_enforce_on_create: true` lets that one creating push through while
every subsequent push to the branch is fully gated. Verified against the live ruleset:
creating `release/v*` succeeds; deleting it is still blocked.

If a release branch is created by mistake, an admin removes it by temporarily setting
the ruleset's `enforcement` to `disabled`, deleting the branch, then re-running this
script (which restores `active`).

## Review policy — applied vs. target

`repository-policy.json#pullRequest` holds two blocks:

- **`applied`** — what the rulesets carry now: `required_approving_review_count: 0`.
- **`target`** — the intended end state: `required_approving_review_count: 1` with
  `require_last_push_approval: true`.

The target is **not** applied because the repository has a single collaborator, and
GitHub does not let an author approve their own PR — `count: 1` would make every PR
(including PR #1) unmergeable. `configure-repository.mjs` prints this gap loudly on
every run; it is a deliberate, recorded pending item, not a silent `0`.

**Admin step to reach the target:** add a second collaborator with at least Write
access —

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh api -X PUT "repos/$REPO/collaborators/<user>" -f permission=push
```

— then set `pullRequest.applied` equal to `pullRequest.target` in the policy file and
re-run the script. Only an approving review from a user with write access satisfies the
gate; code ownership is intentionally not used (there is no `.github/CODEOWNERS` — repo
access is managed in GitHub, not in a file).

## Discovering required check names

```bash
gh pr checks <PR_NUMBER>
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh api "repos/$REPO/commits/<SHA>/check-runs" --jq '.check_runs[].name'
```

Job names are the check contexts: `pr-title` (from `pr-title.yml`), `quality` / `test`
/ `build` (from `ci.yml`). If a job is renamed, update `requiredStatusChecks.checks`
and re-run.

## Security features (not managed by this script)

Dependabot alerts, Dependabot security updates, secret scanning, push protection and
private vulnerability reporting are toggled per repository/plan. Enable and verify with
`gh api repos/{owner}/{repo}` (`security_and_analysis`) /
`gh api -X PUT repos/{owner}/{repo}/vulnerability-alerts` /
`gh api -X PUT repos/{owner}/{repo}/private-vulnerability-reporting`. Report actual
observed state — see [`docs/development/dependencies-and-security.md`](../../docs/development/dependencies-and-security.md).
