---
id: development.dependencies-and-security
type: development
title: Dependencies and security
status: current
read_when:
  - reviewing a Dependabot pull request
  - reporting or triaging a vulnerability
  - deciding how to pin a GitHub Action
  - wondering when CodeQL gets turned on
summary: >
  How dependency updates arrive (Dependabot, grouped, weekly), how versions are pinned,
  the vulnerability-report path, the repository security features that are enabled, and
  when CodeQL should be added.
related:
  - development.local-setup
  - development.ci
---

# Dependencies and security

## Dependency versions

- Package versions are **exact** in `package.json` — `pnpm-workspace.yaml` sets
  `savePrefix: ""` so `pnpm add` never writes a range. Every bump is a visible diff.
- The toolchain baseline, and why pnpm and TypeScript are each held a line back, are in
  ADR [0002](../architecture/decisions/0002-toolchain-selection.md).

## Lockfile shape and the dependency graph

The repository pins **pnpm 10** on purpose. pnpm 11+ writes a multi-document
`pnpm-lock.yaml` that GitHub's Dependency Graph and Dependabot cannot parse — they read
only the first document and report **zero dependencies**
(`dependabot/dependabot-core#14794`). pnpm 10's single-document lockfile is parsed
correctly, so Dependabot actually has a dependency tree to scan.

Verify after any lockfile change:

```bash
grep -c '^---$' pnpm-lock.yaml     # must be 0 (single YAML document)
```

And, on the default branch, that GitHub sees real dependencies:

```bash
gh api repos/OWNER/REPO/dependency-graph/sbom --jq '.sbom.packages | length'
```

## Dependabot

[`.github/dependabot.yml`](../../.github/dependabot.yml), weekly (Monday):

| Ecosystem        | Grouping                                                                 | Commit prefix                     |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------- |
| `npm` (pnpm)     | minor + patch collapsed into one `npm-minor-patch` PR; majors individual | `build(deps)` / `build(deps-dev)` |
| `github-actions` | all in one `github-actions` PR                                           | `ci(deps)`                        |

The prefixes are valid Conventional Commits types, so a Dependabot PR passes the
`pr-title` check unchanged. Dependabot **security** updates (out-of-cycle patches for
advisories) are enabled separately and are not grouped.

Review a Dependabot PR like any other: `pnpm check` must pass; skim the changelog for
behavior changes; for a grouped PR, note anything that isn't purely mechanical.

## GitHub Action pinning

Actions are pinned to **release tags**, not SHAs. The trade-off and the upgrade path
are documented in [`.github/workflows/README.md`](../../.github/workflows/README.md).

## Vulnerability reports

Private reporting via the repository **Security** tab — see [`SECURITY.md`](../../SECURITY.md).
Do not open a public issue.

## Enabled security features

Verified on GitHub:

- Dependabot alerts
- Dependabot security updates
- Secret scanning
- Secret scanning push protection
- Private vulnerability reporting

Re-check with:

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh api "repos/$REPO" --jq '.security_and_analysis'
gh api "repos/$REPO/private-vulnerability-reporting"
```

## CodeQL

Not enabled yet — the repository has no product source code to analyze. Add
`github/codeql-action` (`javascript-typescript`) and make `CodeQL` a required check in
the same change that migrates the first product package. See
[`.github/workflows/README.md`](../../.github/workflows/README.md#codeql).
