# `nevo-repo-github`

Idempotent administration of this repository's GitHub settings through the
authenticated [`gh`](https://cli.github.com/) CLI. Private, never published, and
never a `nevo-spec` product surface (ADR 0005).

> A checked-in JSON file does not configure GitHub by itself. The source of truth is
> GitHub's actual settings. [`repository-policy.json`](repository-policy.json) is the
> desired state; `nevo-repo-github configure` reconciles GitHub to it and verifies
> the result.

## Usage

```bash
pnpm --filter nevo-repo-github build
node tools/github/dist/bin.js configure --check   # report drift, change nothing
node tools/github/dist/bin.js configure           # apply, then verify
```

Requires `gh` authenticated as a repository **admin**. The tool detects the repo from
the checkout, contains no secrets, matches rulesets by name (safe to re-run), prints
what it changed, and exits non-zero on verification failure or (`--check`) any drift.

## Architecture

Same layered contract as the other `tools/*` packages:

```
src/
  domain/     diff-partial · policy (parse + the pure PR-review decision) · ruleset
  app/        configure-repository — the reconcile use case, returns a structured result
  infra/      gh-client — the GitHubAdminClient over the `gh` CLI
  cli/        thin Commander wiring
  bin.ts      executable boundary
```

`configureRepository(client, policy, { checkOnly })` is driven by a fake
`GitHubAdminClient` in `test/app/` — the full merge-settings + ruleset reconciliation,
the bootstrap exception, and the fail-closed path are exercised without a real repo.

## What it configures

**Merge settings**: squash-only (merge commits and rebase merges disabled), auto-delete
head branches, auto-merge allowed, squash commit title/body taken from the PR.

**Rulesets** `protected-main` (`refs/heads/main`) and `protected-release-lines`
(`refs/heads/release/v*`), identical rules:

| Rule                      | Effect                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `deletion`                | branch cannot be deleted                                                                          |
| `non_fast_forward`        | no force-push                                                                                     |
| `required_linear_history` | linear history                                                                                    |
| `pull_request`            | PR required; squash-only; review threads resolved; stale approvals dismissed; (see review policy) |
| `required_status_checks`  | strict; `pr-title`, `quality`, `test`, `build`; **`do_not_enforce_on_create: true`**              |

No bypass actors.

### `do_not_enforce_on_create`

`nevo-release cut-line` creates `release/vX.Y` by pushing a commit directly (there is no
PR that can bring a branch into existence, and no CI can have run on a branch that does
not exist yet). `do_not_enforce_on_create: true` lets that one creating push through
while every subsequent push is fully gated. Verified against the live ruleset: creating
`release/v*` succeeds; deleting it is still blocked.

## Review policy

`repository-policy.json#pullRequest` holds **one durable target**: 1 required approval,
stale reviews dismissed on a new reviewable push, latest push must be approved, review
threads resolved, squash only.

`configure` reads the repository's actual collaborators (write/admin = "eligible
reviewer") and:

- **≥ 2 eligible reviewers** → applies the target verbatim.
- **API readable, < 2 eligible reviewers** → applies a **bootstrap exception**
  (`required_approving_review_count: 0`, last-push approval off) because GitHub does not
  let an author approve their own PR, so `1` would block every PR. It prints
  `PR REVIEW POLICY — BOOTSTRAP EXCEPTION IN EFFECT` with the reason.
- **collaborators API not readable** → the run **aborts without touching any ruleset**
  and exits non-zero (`CANNOT VERIFY REVIEWER ELIGIBILITY`). The 0-approval exception is
  only ever applied from a successful read proving fewer than two eligible reviewers —
  a discovery failure never weakens the policy. The pure decision lives in
  [`src/domain/policy.ts`](src/domain/policy.ts) (`decidePrReviewPolicy`).

Adding a second Write collaborator and re-running converges to the target **with no
edit to the policy file**. Code ownership is intentionally not used (there is no
`.github/CODEOWNERS` — repository access is managed in GitHub).

## Security features (not managed by this tool)

Dependabot alerts, Dependabot security updates, secret scanning, push protection and
private vulnerability reporting are toggled per repository/plan. Enable and verify with
`gh api repos/{owner}/{repo}` (`security_and_analysis`) /
`gh api -X PUT repos/{owner}/{repo}/vulnerability-alerts` /
`gh api -X PUT repos/{owner}/{repo}/private-vulnerability-reporting`. Report actual
observed state — see
[`docs/development/dependencies-and-security.md`](../../docs/development/dependencies-and-security.md).
