---
id: ideas.specflow-engine.plan-02.task-10
type: engineering
title: 'E2.T10 — Lifecycle contracts, preview and durable reservation'
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, lifecycle-closure]
read_when:
  - implementing or reviewing E2.T10
summary: >
  Temporary Plan 02 task: Lifecycle contracts, preview and durable reservation.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.test-plan
---

# E2.T10 — Lifecycle contracts, preview and durable reservation

**Temporary task, documentation only.** Branch feature/specflow-engine-foundation / existing PR #53. No product implementation exists merely because this plan is present. This file must be removed with the entire temporary execution-plans tree before PR merge.

## Executable prerequisites

- E2.T09 accepted (new scaffold contract and old Create journal recovery)
- Owner-approved DC05, DC08, DC10, DC13, DC16 direction applied; remaining Git target, merge recovery and source ownership choices reviewed against actual repo

Run mode: **SOLO / independent architecture review**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC18 before editing code.

## Modules and ownership

Engine: new specs/lifecycle/{model,preflight,journal,store,reservation,inspect} and narrowly exported application DTOs in specflow-engine/src/index.ts. Contracts: packages/specflow-contracts/src/specs/close.ts only for shared operation types; no adapter routes yet.

## Required behavior / exact acceptance

1. Closed discriminated kinds worktree-close and specification-close with separate legal stage transitions, request fingerprints, error union and evidence-bearing result. Specification-close pins integrateToTargetBranch (default true only for linked; primary means not-applicable), and has TWO verified terminal outcomes: integrated-and-removed versus locally-archived-and-retained. Worktree-close preserves active OR archived location. Typed idempotent operationId semantics; no create journal pollution.
2. Read-only preview resolves canonical spec, actual linked/primary source, Project Home .nevo/config.yaml git.integrationTargetBranch (required validated project policy, not a per-request default), actual primary destination/checked-out branch and expected HEAD; when integrateToTargetBranch=false no primary integration/cleanup admission required but source archive preflight remains strict; inspects index/untracked state and existing Engine journals; never changes files, refs or registry.
3. Verify configured integration target from Project Home, include exact project config revision and selected integrateToTargetBranch in fingerprint; require explicit init/config migration if integration is requested and no target exists. Never assume main/develop or silently switch primary checkout. Pin pre-mutation source/destination HEAD, git-instance and linked instanceId, exact specId/slug/location, source tree identity, registry revision and binding generation, other bound occupants and touched Spec paths. For linked Specification close the later Engine-owned archive commit MUST persist a distinct integrationSourceCommit, not overwrite the pre-archive HEAD evidence. Inherited primary manifests are NOT extra linked occupants.
4. Publish versioned local intent under short Project Home coordination; reject same-id changed fingerprint and different-id concurrent mutation of same spec. Reconcile unknown concurrent process as inspection/recovery-required, not PID/TTL takeover. Unknown journal/schema fails closed. Inspect a SIGKILL-orphaned short Project Home control lock explicitly; any manual recovery of that lock requires verified no-active-owner evidence and trusted operator action, never PID/age heuristics. This is a narrow Foundation operator-recovery requirement, NOT the future persistent workspace-writer claim mechanism.
5. Standalone offline Engine inspection API returns in-progress stages and actionable blockers. Journal tracks ONLY real effects (archive/commit/integration/rebind/removal), not fictional exit-gate decisions or OS-process claims; no `gateDisposition`, `exitEvaluation`, `closureAuthorization`, caller admin-bypass/acknowledgement or external-process attestation input. Do not claim short journal lock fences arbitrary writers. No generic public Git mutation interface.

## Required evidence

- Positive: preview produces a stable immutable plan for primary and eligible linked spec without mutation; same-ID identical intent is observable
- Negative/no unintended effects: dirty/staged/untracked, wrong primary branch, linked identity substitution, duplicate source, unresolved creation journal and competing ID produce explicit blockers with exact zero mutation
- Report LC test IDs, test files, OS/Node/Git version for real filesystem/process work, PASS/FAIL/SKIP, modified public contracts, and an independent code-quality/recovery review. Mock-only tests do not satisfy Git/process cases.
- Checkpoint for this task: Review durable state machine and preview security before any Git side effects.
- Preserve completed E2.T01–T08; avoid unrelated refactors. No Plan 03 or Session dependency.

## Sources

- [Plan 02](../README.md)
- [Close architecture](../../../specification-and-worktree-close-design.md)
- [Decisions needing approval](../../../specification-close-decisions.md)
- [Lifecycle test matrix](../../../test-plan.md)
