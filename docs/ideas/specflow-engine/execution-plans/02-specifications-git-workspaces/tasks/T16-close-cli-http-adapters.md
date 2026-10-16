---
id: ideas.specflow-engine.plan-02.task-16
type: engineering
title: 'E2.T16 — Offline CLI and authenticated HTTP parity'
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, lifecycle-closure]
read_when:
  - implementing or reviewing E2.T16
summary: >
  Temporary Plan 02 task: Offline CLI and authenticated HTTP parity.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.test-plan
---

# E2.T16 — Offline CLI and authenticated HTTP parity

**Temporary task, documentation only.** Branch feature/specflow-engine-foundation / existing PR #53. No product implementation exists merely because this plan is present. This file must be removed with the entire temporary execution-plans tree before PR merge.

## Executable prerequisites

- E2.T13 accepted
- E2.T15 accepted
- Spec capability authorization contract reviewed

Run mode: **SOLO / security review**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC18 before editing code.

## Modules and ownership

packages/specflow/src/specs/command.ts for CLI; packages/specflow-runtime/src/features/specs/close/{endpoint,error-status}.ts and feature.ts for HTTP; packages/specflow-contracts/src/specs/{close,capabilities,index}.ts. No Engine Git/registry mutation in transport.

## Required behavior / exact acceptance

1. Add CLI specs worktree close <spec-id> and specs close <spec-id>, read-only preview/check and inspect/resume where safe. --json, --operation-id, --integrate/--no-integrate for linked Specification close, explicit confirmations, stable nonzero exit and actionable error code, with Runtime OFF.
2. Persist git.integrationTargetBranch via project init/configuration and read only trusted Project Home policy; do not let an HTTP body/CLI flag override configured target without a distinct authorized reconfiguration. POST /api/specs/{specId}/worktree/close and POST /api/specs/{specId}/close, with read-only preview/operation status endpoints as needed. HTTP validates requests, enforces authenticated narrowly scoped CloseWorktree and CloseSpecification independently of Create, resolves canonical identity securely, and returns typed result/status.
3. Selector fields cannot grant authorization; do not leak unauthorized spec metadata, paths, branch names or journal status. No demo/fixture fallback, no unconfigured Engine writes, no bypass using the administrative no-evaluator acknowledgement. Avoid granting local workstation workspaceId as portable Auth scope.
4. Typed result must distinguish integrated-and-removed, locally-archived-and-retained, integration-requires-resolution, and post-effect cleanup pending. Conflict-resolution actions (self vs agent) are future UI/workflow operations, not transport flags that claim execution. Error mapping explicit/exhaustive (400/401/403/404/409/422/503; unexpected 500); public JSON result distinguishes not-configured exit evaluation and cleanup pending from completed success. Runtime live reads resolve new binding/archive and invalidate refresh data.

## Required evidence

- Positive: same Engine outcome, idempotency and canonical live Overview in offline CLI and authorized HTTP
- Negative/no unintended effects: no capability, wrong scope, unresolved operation, Engine unavailable, forged destination/workspace selector yield correct safe responses with zero Git/fs/registry effect
- Report LC test IDs, test files, OS/Node/Git version for real filesystem/process work, PASS/FAIL/SKIP, modified public contracts, and an independent code-quality/recovery review. Mock-only tests do not satisfy Git/process cases.
- Checkpoint for this task: Independent authz review and HTTP schema/CLI parity tests.
- Preserve completed E2.T01–T08; avoid unrelated refactors. No Plan 03 or Session dependency.

## Sources

- [Plan 02](../README.md)
- [Close architecture](../../../specification-and-worktree-close-design.md)
- [Decisions needing approval](../../../specification-close-decisions.md)
- [Lifecycle test matrix](../../../test-plan.md)
