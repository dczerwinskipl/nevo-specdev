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

- E2.T09 accepted (single specification.yaml and current Create journal recovery; no prototype compatibility)
- Owner-approved DC05, DC08, DC10, DC13, DC16 direction applied; remaining Git target, merge recovery and source ownership choices reviewed against actual repo

Run mode: **SOLO / independent architecture review**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC18 before editing code.

## Modules and ownership

Engine: new specs/lifecycle/{model,preflight,journal,store,reservation,inspect} and narrowly exported application DTOs in specflow-engine/src/index.ts. Contracts: packages/specflow-contracts/src/specs/close.ts only for shared operation types; no adapter routes yet.

## Required behavior / exact acceptance

1. Closed discriminated kinds worktree-close and specification-close with separate legal stage transitions, request fingerprints, error union and evidence-bearing result. Specification-close pins integrateToTargetBranch (default true only for linked; primary means not-applicable), and has THREE explicit settled linked-Specification outcomes: (1) integrated-and-removed (successful integration and cleanup), (2) archive-only-closed (requested integrate=false, linked worktree retained, normal success), and (3) archived-linked-awaiting-integration (requested integrate=true, known Git content conflict, local archive committed but integration NOT successful; retains linked binding/worktree). Direct primary Specification close is a separate archived-in-primary success. Pending/unknown Git or filesystem effects are NOT settled outcomes. Worktree-close preserves active OR archived location. Typed idempotent operationId semantics; no create journal pollution. A proved `archived-linked-awaiting-integration` releases shared claims ONLY after scratch is confirmed removed or persistently retained with exclusive separate scratch ownership (no overlapping source/target claims); later new CloseWorktree is eligible after external reconciliation. Unknown Git outcome remains recovery-required.
2. Read-only preview resolves canonical spec, actual linked/primary source, Project Home .nevo/config.yaml git.integrationTargetBranch (required validated project policy, not a per-request default), actual primary destination/checked-out branch and expected HEAD; when integrateToTargetBranch=false NO configured target branch, primary checkout admission, or primary-ref/index reservation is needed; only source archive/commit preflight applies; inspects index/untracked state and existing Engine journals; never changes files, refs or registry.
3. Verify configured integration target from Project Home only for target-dependent operations (direct primary Specification close, linked integrate=true and CloseWorktree); pin config revision/target when applicable. Linked integrate=false MUST NOT fail merely because target branch is absent/unknown. Require explicit init/config migration if a target-dependent operation is requested and config is missing. Never assume main/develop or silently switch primary checkout. Pin pre-mutation source/destination HEAD, git-instance and linked instanceId, exact specId/slug/location, source tree identity, registry revision and binding generation, other bound occupants and touched Spec paths. For linked Specification close the later Engine-owned archive commit MUST persist a distinct integrationSourceCommit, not overwrite the pre-archive HEAD evidence. Inherited primary manifests are NOT extra linked occupants.
4. Publish versioned local intent under short Project Home coordination; reserve real SHARED physical checkout/index, Git full branch-ref and worktree-metadata resources (plus specId) across different Spec IDs, not just the same Spec. An Engine-owned durable Project Home reservation record is published under the short lock BEFORE Git/fs effects, acquired in deterministic resource order and held across processes until actual effects are proven. `specs/create/reservation.ts` AND its real effect/settlement stages must use the SAME resource coordination so Create cannot begin after Close inspects journals; unfinished CURRENT Create journals without shared resource reservations must conservatively block overlapping Close until independently verified or recovered. Independent linked, nonconflicting Create/Close continue to work. No speculative scheduler/worker registry. reject same-id changed fingerprint and different-id concurrent mutation of same spec. Reconcile unknown concurrent process as inspection/recovery-required, not PID/TTL takeover. Unknown journal/schema fails closed. Inspect a SIGKILL-orphaned short Project Home control lock explicitly; any manual recovery of that lock requires verified no-active-owner evidence and trusted operator action, never PID/age heuristics. This is a narrow Foundation operator-recovery requirement, NOT the future persistent workspace-writer claim mechanism.
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

## Required self-review corrections before T10 ACCEPT

- **P1 configuration ownership:** In T10 update the REAL Project Home Git config policy parser/validator (currently `version-control/worktrees/policy.ts` rejects unknown `git` keys) to support `git.integrationTargetBranch` and implement a read-only, explicit migration-required outcome for existing projects with runtime-only config. Do not auto-edit already initialized config. The existing `git.enabled` switch governs NEW worktree creation, NOT integration of already registered worktrees. Pin validated branch and config revision in the intent. T16 later implements init/reconfigure UX; T10 tests can build explicit config fixtures.
- **P2 direct primary:** Direct primary Specification archive commit requires the Project Home primary checkout to be on the configured integrationTargetBranch even without a merge. Otherwise fail before journaled side effects; do not commit archive on an accidental feature branch.
- **P1 conflict state:** Shape the versioned journal to distinguish 'archived locally, integration needs resolution, linked source retained' from true integrated completion and unknown Git effects. A known conflict must not permanently monopolize the Spec or conceal the existing committed archive. Later CloseWorktree must remain viable after supported external reconciliation.
