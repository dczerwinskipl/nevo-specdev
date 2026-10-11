---
id: ideas.specflow-engine.baseline-evidence
type: architecture
title: Baseline and migration evidence
status: draft
scope: specflow
areas: [runtime, workflow, cli, docs]
tags: [legacy-nevo, pr-review, migration]
read_when:
  - comparing main to open PR 45 before implementing engine foundations
  - deciding what existing functionality should be preserved
summary: >
  Code-evidenced distinction between committed SpecFlow architecture, unmerged PR 45 direction,
  and useful or problematic legacy Nevo implementation details.
related:
  - ideas.specflow-engine
  - architecture.repository-structure
  - architecture.workflow.deterministic-workflow
  - architecture.runtime.ownership-and-lifecycle
---

# Baseline and migration evidence

## Revisions and authority

- Implementation base examined: `dczerwinskipl/nevo-specflow@e0ffd59119abc833f814502db25db84542313e3a`, default branch `main`.
- Preview examined: [PR #45](https://github.com/dczerwinskipl/nevo-specflow/pull/45), head `612d9c19348d83465fa8d6cfc71d5f9c4d58a4c8`, base `feature/spec-workbench-ux` (the #39 stack). **Unmerged and not a dependency** of this proposal.
- Legacy evidence: [`dczerwinskipl/nevo`](https://github.com/dczerwinskipl/nevo), inspected on `main`. It contains legacy and deterministic paths; migrate only the deterministic workflow semantics, not both modes.
- Before implementing, fetch fresh HEADs, merge status, changed filenames and relevant code, particularly after #45 lands. The SHA values above are inspection snapshots, not evergreen facts.

## Verified on SpecFlow main

- `packages/specflow/src/program.ts` composes Commander commands; `packages/specflow/src/project/layout.ts` resolves Git top-level with `git rev-parse --show-toplevel`.
- `packages/specflow-runtime/src/server/app.ts` composes Auth, Specs, Sessions and Settings HTTP features. `runtime.ts` starts the Fastify service. `packages/specflow-runtime/src/features/specs/` has the Specs Overview read boundary.
- `docs/architecture/decisions/0012-product-package-topology-and-dependency-direction.md` makes `@nevo/specflow` the npm artifact/composition root, with Runtime and UI as capability packages; product remains one installable artifact.
- `docs/architecture/workflow/deterministic-workflow.md` already says surfaces use the same application operations and the step engine is deterministic.
- `docs/architecture/runtime/ownership-and-lifecycle.md` gives Runtime ownership of live resources (provider processes, streams, listeners) and restart reconciliation.
- `.nevo/local/` is ignored and `.nevo/local/state/` reserved for local application data. YAML is used for human-authored config and frontmatter.
- There is **not** yet a complete migrated workflow, real production Spec creation + multi-worktree support, or a verified offline engine boundary.

## PR #45 preview (do not mistake for main)

- Specs Workspace HTTP endpoint in `packages/specflow-runtime/src/features/specs/workspace/endpoint.ts` delegates to an optional `SpecificationWorkspaceRepository` and reports source unavailable rather than silently substituting fixtures.
- Specs Overview likewise uses `SpecsOverviewRepository`.
- `SpecsFeatureDependencies` can supply `overviewRepository` and `workspaceRepository`; demo is an explicit backend data mode.
- UI feature ownership, typed feature APIs, routes, and reusable HTTP transport are increasingly independent of the Specs aggregate. Task/Document/Git/Session contributions are **UI architecture preview**, not evidence of a working Git/workflow backend.
- Those repositories are presently read ports, not necessarily a final application/service boundary for mutations; retain the good seam, avoid making HTTP handlers the owner of execution semantics.
- Use #45 for compatibility review when defining actual Specification reads and creation; do not require the new work to merge into or depend on the open branch.

## Legacy Nevo: useful mechanisms

| Source                                      | Evidence                                                     | Candidate treatment                                              |
| ------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `tools/specs.mjs`                           | Commander entrypoint dispatches to `tools/specs/**`          | Retain thin CLI interface, not implementation imports            |
| `tools/specs/workflow/**`                   | Step start/finish, gates, projections, durable operations    | Migrate deterministic semantics after boundaries proven          |
| `tools/specs/workflow/workspace-writer.mjs` | Physical-worktree-scoped short control lock and longer claim | Preserve invariant, redesign independent owners/recovery         |
| `tools/specs/workflow/operation-record.mjs` | Durable attempt-specific records                             | Port semantics to Engine-owned store                             |
| `tools/lib/git.mjs`                         | Git takes root arguments in many functions                   | Build a narrow Git capability; do not copy whole wrapper blindly |
| `tools/dashboard/server/ai/**`              | Managed providers, Sessions and Turns                        | Remain live Runtime-owned; do not make Engine depend on them     |

## Legacy Nevo: avoid copying

- `tools/specs/store.mjs` has module-relative `ROOT`, `ACTIVE_DIR` and `ARCHIVE_DIR` constants; `process.cwd()` appears elsewhere. This obstructs multi-root discovery.
- `tools/dashboard/server/specs/actions/deterministic-mutations.mjs` imports `handleWorkflowVerifyHuman` from the CLI adapter, reversing dependency direction.
- `tools/specs.mjs` and `tools/specs/agent-session.mjs` import a dashboard-internal binding service; external CLI is coupled to Runtime implementation.
- `tools/dashboard/server/specs/routes.mjs` owns pieces of mutation/recovery/Git logic that should live in an application operation.
- `tools/dashboard/server/ai/routes.mjs` configures provider instances for a fixed `cwd`, not arbitrary per-spec execution roots.
- Old finalize assumes checkout to the base branch in one worktree; this is not safe to reuse for multiple linked Git worktrees.

## Existing docs to reconcile later

There is tension between Runtime owning 'local execution records' and the offline Engine owning canonical workflow operation records. Treat this as a **proposed adjustment** to `architecture/runtime/ownership-and-lifecycle.md`, `architecture/runtime/configuration.md` and possibly ADR 0012 after proof; **do not edit normative docs to pretend acceptance**.

The preexisting provider Session/Turn model and provider worktree-resume compatibility remain authoritative for Runtime-managed sessions. Independent CLI work may have no such session.

## Review follow-up: Session readiness and new contract seams

On `main`, `packages/specflow-runtime/src/features/sessions/feature.ts` currently registers Session capabilities only; the authoritative `docs/architecture/ai/canonical-session-turn-work.md` permits a composite `ProviderSessionRef` as the interim Session locator until a product session ID exists. The new proposal must intentionally choose an application-owned stable `sessionId` _when Sessions migrate_ rather than assert it already exists. Current workflow architecture's trusted executor/admission invariant still applies when CLI is offline: the new local actor contract must define a trustworthy application context, not accept agent-authored Session IDs.

PR #45 HEAD is a **dated preview only** and may change independently. Re-evaluate its merged successor immediately before implementing Spec reads; never count a preview endpoint as working `main` capability.
