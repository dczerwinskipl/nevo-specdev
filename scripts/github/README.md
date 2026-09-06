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

## Review policy

`repository-policy.json#pullRequest` holds **one durable target**: 1 required approval,
stale reviews dismissed on a new reviewable push, latest push must be approved, review
threads resolved, squash only.

`configure-repository.mjs` reads the repository's actual collaborators (write/admin =
"eligible reviewer") and:

- **≥ 2 eligible reviewers** → applies the target verbatim.
- **API readable, < 2 eligible reviewers** → applies a **bootstrap exception**
  (`required_approving_review_count: 0`, last-push approval off) because GitHub does not
  let an author approve their own PR, so `1` would block every PR. It prints:

  ```
  PR REVIEW POLICY — BOOTSTRAP EXCEPTION IN EFFECT
    target policy    : 1 approval
    effective policy : 0 approvals
    reason           : only 1 eligible reviewer (…)
  ```

- **collaborators API not readable** → the run **aborts without touching any ruleset**
  and exits non-zero (`PR REVIEW POLICY — CANNOT VERIFY REVIEWER ELIGIBILITY`). The
  0-approval exception is only ever applied from a successful read that proves fewer
  than two eligible reviewers — a discovery failure never weakens the policy. The pure
  decision lives in [`policy.mjs`](policy.mjs) and is covered by `policy.test.mjs`.

Adding a second collaborator with Write access —

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh api -X PUT "repos/$REPO/collaborators/<user>" -f permission=push
```

— and re-running the script converges to the target **with no edit to the policy
file**. Code ownership is intentionally not used (there is no `.github/CODEOWNERS` —
repository access is managed in GitHub).

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
