---
id: ideas.specflow-engine.plan-01
type: engineering
title: Temporary execution plan 01 — Engine and Project Foundation
status: draft
scope: specflow
areas: [cli, runtime, configuration, workflow]
tags: [execution-plan, temporary, engine, project-home]
read_when:
  - executing the temporary Engine migration proof of concept
  - reviewing implementation tasks, verification and dependency gates
summary: >
  Disposable implementation plan for reusable offline Engine composition, canonical Project Home, workspace identity, and local state safety.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.acceptance
  - ideas.specflow-engine.test-plan
  - architecture.principles.enforceable-invariants
---

# Plan 01 — Engine and Project Foundation

**Lifecycle: temporary implementation plan.** This is deliberately **not** the future SpecFlow specification format or an ADR. Complete tasks, verify the contract, move durable decisions into their authoritative homes, and remove this file when the temporary program ends.

**Implementation baseline:** fresh `main` when work begins; the idea dossier is [PR #50](https://github.com/dczerwinskipl/nevo-specflow/pull/50) (draft, candidate design). Reinspect merged changes rather than relying on its original 10 October baseline or treating #45 as unmerged. Existing current docs outrank `draft` ideas; architectural conflicts require a decision, not a quiet override.

## Target and independently verifiable result

A separate CLI process launched in a primary or **registered** linked Git worktree finds **one** Project Home and the correct current execution root. CLI and Runtime share the same application Engine and durable coordination state without requiring Runtime to be running. No new speculative workflow or session service is necessary to prove this boundary.

Existing seams: `packages/specflow/src/program.ts` (composition), `packages/specflow/src/project/`, `packages/specflow-runtime/src/features/specs/`, `@nevo/specflow-contracts` and existing single-artifact bundling. The public CLI currently has `init`, `start` and `auth` but no `specs` or `workflow` command; do not describe proposed commands as existing.

## Task sequence

| Task | Implement and prove | Depends on |
| --- | --- | --- |
| E1.T01 — Contract baseline | Inspect latest main code, test fixtures, ADR 0012 and legacy Nevo candidates. Record feature owners, existing paths, reuse/replace decisions, and the decision list D01/D02/D06/D16/D17/D24/D25. Prefer extending existing capabilities over moving unrelated code. | — |
| E1.T02 — Engine boundary | Introduce an independent application source boundary, provisionally `@nevo/specflow-engine` only if import/build evidence supports it; composition root bundles exactly one product CLI. Engine must not import Fastify, Commander, Runtime Sessions/providers, UI or CLI adapters. | T01 |
| E1.T03 — Project Home resolver | Implement verified `cwd -> Git checkout -> common-dir -> designated home` with explicit validated override; distinguish local project identity, committed operational config at home, local ignored config, and active workspace root. Reject ambiguous, absent or substituted home. | T01–T02 |
| E1.T04 — Workspace registry | Establish versioned local registry identity `workspaceId -> root`, optional `specId -> workspaceId`, membership verification, unavailable/corrupt states, and atomic local read/update ports. Different clone sharing a remote must not join the local registry. | T03 |
| E1.T05 — Shared coordination primitives | Implement short cross-process control/registry lock and deterministic address; atomic record writes and explicit corruption handling. No long-running writer claims here (Plan 03). Prove races using independent OS processes, not only promises. | T04 |
| E1.T06 — CLI/Runtime composition | Wire the same Engine instance/factory at both adapter boundaries, without requiring an HTTP listener for Engine calls. Runtime bootstrap obtains its Project Home config from the same provenance as CLI; linked branch may not override Auth/Git project policy. | T02–T05 |
| E1.T07 — Boundary and error tests | Add real temporary Git repos, linked worktree, separate CLI processes, ambiguous/missing Project Home, invalid explicit locator, independent clone, corrupt state, path substitution, Windows/POSIX platform evidence and import-graph/packaging tests. | T03–T06 |

## Design decisions this plan must resolve

- **Project Home selection**: choose a concrete locator/marker and recovery diagnostic. Git common-dir is membership evidence, not an automatic SpecFlow state owner.
- **Config provenance**: operational `.nevo/config.yaml` plus `.nevo/local/config.yaml` from designated home; workspace-specific Git-tracked workflow definitions will be handled by Plan 03.
- **Local vs portable identity**: `workspaceId` is local. Existing committed `runtime.authorization` policy must not bind portable grants to that local ID. Stable `specId` and project-level capabilities are candidates; validate allowed dimensions at feature boundary.
- **Topology**: local filesystem + Git-backed project are supported first; NFS/multi-host and non-Git projects intentionally deferred.
- **Moved/deleted home**: reliably detect and fail closed, retaining repair evidence. Successful automatic relocation of home is **deferred**, not secretly marked passing.

## Verification / exit gate

- CLI from primary and registered linked checkout resolves the same Project Home/state and distinct `workspaceId`; Runtime off (P01, C10).
- Missing/ambiguous home, wrong override, independent clone and bad state fail without new empty registry (P02–P04, L07).
- Linked committed config diverges, but Runtime/CLI operational policy stays owned by home; no local `workspaceId` in portable Auth grant (P06, H10).
- Cross-process registry updates do not lose or interleave writes (L02).
- One installable CLI, independent Engine imports, and tested Windows/POSIX real Git paths.

**Not in this plan:** Spec creation, worktree provisioning, full recovery journal, managed Session, long execution claim or workflow attempt. They belong to Plans 02–05.

## Sources and handoff

- [Project Home discovery](../project-home-discovery.md), [project/workspace context](../project-and-workspace-context.md), [registry](../workspace-registry-and-discovery.md), [Engine boundaries](../engine-cli-runtime-boundaries.md), [local actors/auth](../local-actor-and-human-gates.md).
- [ADR 0012](../../../architecture/decisions/0012-product-package-topology-and-dependency-direction.md), [Runtime configuration](../../../architecture/runtime/configuration.md), [CLI contract](../../../reference/cli/nevo-specflow-contract.md), [acceptance](../acceptance-criteria.md).

**Ready for Plan 02:** a single Engine boundary, deterministic project locator and local coordination primitive tested by independent processes. A remaining implementation choice is acceptable only if it does not change identities, actor trust or source authority.
