# `scripts/github/`

Idempotent administration of this repository's GitHub settings, applied through the
authenticated [`gh`](https://cli.github.com/) CLI.

> A checked-in YAML/JSON file **does not** configure GitHub by itself. The source of
> truth is GitHub's actual settings. [`repository-policy.json`](repository-policy.json)
> is the desired state; [`configure-repository.mjs`](configure-repository.mjs) is what
> reconciles GitHub to it and verifies the result.

## Usage

```bash
node scripts/github/configure-repository.mjs --check   # report drift, make no changes
node scripts/github/configure-repository.mjs           # apply, then verify
```

Requires `gh` authenticated as a user with **admin** on the repository
(`gh auth login`). The script:

- refuses to run if `gh` is not authenticated;
- detects the repository from the checkout (`gh repo view`), nothing is hard-coded;
- contains no tokens or secrets;
- matches rulesets by **name** and updates them in place — safe to re-run;
- prints exactly what it changed and exits non-zero if verification fails or, in
  `--check` mode, if anything differs.

## What it configures

**Merge settings** (`repos/{owner}/{repo}`): squash-only (merge commits and rebase
merges disabled), auto-delete head branches, auto-merge allowed, squash commit
title/body taken from the PR.

**Rulesets** (`repos/{owner}/{repo}/rulesets`):

| Ruleset                   | Targets                 | Rules                                                                                                                           |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `protected-main`          | `refs/heads/main`       | PR required, squash-only merge, review threads resolved, stale approvals dismissed, linear history, no force-push, no deletion. |
| `protected-release-lines` | `refs/heads/release/v*` | Same as `protected-main`.                                                                                                       |

`required_approving_review_count` is **0** for now and `require_code_owner_review` is
**false** — a single maintainer cannot approve their own PR. Raise the count (and enable
code-owner review) from the GitHub UI, or by editing `repository-policy.json` and
re-running, once there is a second maintainer. `CODEOWNERS` is already in place so the
change is just a number.

No bypass actors are configured. Any bypass must be a deliberate, documented decision.

## Required status checks

`repository-policy.json` → `requiredStatusChecks.checks` holds the exact check-run
(job) names: `pr-title` (from `pr-title.yml`) and `quality` / `test` / `build` (from
`ci.yml`). The script adds a strict `required_status_checks` rule with these to both
rulesets.

To re-confirm the names against a real run:

```bash
gh pr checks <PR_NUMBER>
# or
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh api "repos/$REPO/commits/<SHA>/check-runs" --jq '.check_runs[].name'
```

If a job is renamed, update the array and re-run the script.

## Not handled here

Dependabot alerts, Dependabot security updates, secret scanning and push protection are
security features toggled per repository/plan — see
[`docs/`](../../docs/) task notes and configure them via
`gh api repos/{owner}/{repo}` (`security_and_analysis`) or the repository **Settings →
Code security** page. Report the actual observed state; do not assume.
