---
id: ideas.specflow-engine.specification-worktree-closure
type: architecture
title: Specification and managed worktree closure, Foundation A extension
status: draft
scope: specflow
areas: [workflow, cli, runtime, security, testing]
tags: [specification-lifecycle, worktree, durable-operation, temporary-design]
read_when:
  - implementing Plan 02 E2.T10 through E2.T17
  - reviewing Specification close versus Worktree close
summary: >
  Proposed recoverable, transport-neutral close operations without a dependency on Plan 03,
  and a conservative future Specification workflow seam.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.workspace-binding-lifecycle
  - ideas.specflow-engine.worktrees
  - ideas.specflow-engine.recovery
  - ideas.specflow-engine.acceptance
---

# Specification and worktree closure: architecture proposal

Status: proposed for independent architectural review, NOT production authority. Verified against branch feature/specflow-engine-foundation at 3e328f6 (2026-10-16); re-check HEAD when implementing.

## Verified code baseline and compatibility

- Engine exports createSpecificationFromRequest, discoverSpecifications, resolveSpecification; CLI owns specs create/list/resolve; Runtime owns POST /api/specs and GET /api/specs/overview.
- WorkspaceRegistry has primaryWorkspaceId, registration kind/managed/instanceId and SpecWorkspaceBinding.generation. registry-store intentionally rejects ANY rebind or workspace removal: implement a narrow, independently reviewed lifecycle transition, not a general relaxation of append-only registration.
- VersionControl.worktrees is an INTERNAL create-only port; the local Git client currently provides creation, worktree inspection and refs but no integration/commit/removal operations.
- Durable Create v2 records one creation intent, evidence checkpoints and manual interrupted-process confirmation. Reuse validated primitives and semantics, NOT creation journal schemas or flags.
- The legacy nevo workflow step finish is TASK/step/attempt-scoped. Its gate inspect/verify and action check/execute separation is reusable as an idea, but the legacy spec finalize invokes branch checkout/PR operations that are unsafe in linked worktrees.
- The deterministic workflow model is the ONLY SpecFlow workflow model. No Specification execution-mode selector is a domain concept. The current Engine scaffold has a redundant mode marker (implementation cleanup in E2.T09). Historic Create operation journals must retain byte-accurate replay of prior scaffold fingerprints even after new scaffolds omit that marker. No installed Specification workflow evaluator exists; neither scaffold metadata nor Task status is exit-gate evidence.

## Separate use cases and outcomes

Worktree close: only a Spec canonically bound to an exclusive, managed linked checkout; integrate its branch into the explicit primary checkout destination; prove destination content; CAS rebind specId to primary; remove its managed worktree; keep Specification location=active and status unchanged. No spec exit gate/action, no archive. Worktree close of primary, unmanaged, shared, missing or substituted checkout fails without mutation. Branch refs remain by default.

Specification close in primary: requires canonical available active Spec in verified primary; no branch integration or worktree creation/removal. After explicit administrative no-evaluator authorization or future Specification exit-gate evaluation, move full spec directory from specs/active/<slug> to specs/archive/<slug>, change manifest status to archived while preserving spec_id, create Engine-owned narrowly scoped archive commit, and verify unique archive record.

Specification close in managed linked checkout: SINGLE close-spec intent; after gates/actions, archive the source in that checkout, create scoped archive commit, integrate into primary, verify archive bytes and specId in PRIMARY, CAS rebind, and remove managed worktree. It is NOT worktree close followed by a second independent archive operation.

Final positive result means verified committed effect, stable identity, registry binding and intended source disposition. After a crash, a nonterminal journal may report integrated or rebound but cleanup-pending; do not emit completed success until evidence confirms every required stage.

## Admission and constraints

- Project Home primary checkout is the destination, but its checked-out local branch MUST equal the explicitly requested destinationBranch, preferably selected in preview. Capture pre-mutation destination HEAD and pre-mutation source HEAD, primary workspace ID, source workspace incarnation/branch, binding generation and registry revision as immutable INITIAL intent evidence. When Close Specification performs an Engine-owned archive commit, persist the NEW verified commit SHA as integrationSourceCommit; do not confuse it with preArchiveSourceHead. All later integration/retry checks use the verified integrationSourceCommit. Neither a branch string nor a workspaceId supplied by the caller authorizes a mutation.
- On FIRST admission source and destination must be in the same verified Git instance, have clean index and worktrees (including untracked files), and have no merge/rebase/cherry-pick/sequencer state. All author-authored changes and the initial scaffold MUST be committed before mutation. Refuse arbitrary dirty/staged/untracked files, not silently stage them. On RECOVERY of an already reserved close, classify only exact, journal-owned archive worktree/index mutations by saved inventory and hashes as recoverable; never rerun the initial global-clean gate blindly and never exempt unrelated dirty content.
- Only one canonically LINKED-BOUND Spec in a managed linked worktree; inherited manifests from the primary base are not additional occupants. Check that the source branch diff does not alter other Specifications' files and that no other explicit binding points to this linked workspace; refuse shared ownership or ambiguous source changes. Reject unmanaged linked worktrees, foreign registrations and unsafe path/identity substitution in this milestone. In primary, unrelated Specs may exist but no dirty files are tolerated. Prior to linked worktree removal, INVENTORY all ignored per-checkout files (particularly .nevo/local), not just git status: the expected Engine identity marker is allowed only if its bytes/identity match; any other retained ignored/user data blocks automatic removal. Do not discard local user config, execution records or untracked artifacts.
- Engine closes only cooperative local activity. Check known unfinished create/close journals and Engine ownership records if present; block anything unresolved. Without Plan 03 claims and Sessions there is NO proof an arbitrary external process has stopped: require explicit operator attestation/confirmation for worktree disposal and document advisory local trust. PID, timeout, clean Git status and confirmation alone are NOT physical fencing. If stronger no-writer guarantees are required, decline automated removal until claims are available.
- Validate canonical manifest and exactly one source record before archive; destination must have exactly the expected record after integration, in active for Worktree close and archive for Spec close. Check both locations, duplicate IDs/slugs, symlink safety and complete directory tree including ancillary files. A stale primary copy is NOT a fallback.
- Git capability disabled is a policy for NEW worktree creation; clean closing of an already managed worktree must use an explicit independently authorized close policy. Do not make a deleted config flag silently strand the worktree or implicitly grant cleanup.

## Conservative Git integration policy (MVP)

Two admissible proofs only:

1. Local primary can advance by fast-forward from pinned destination HEAD to pinned source commit. Require clean primary, exact checked-out branch, and integrationSourceCommit descends from target. Persist git-initiated intent BEFORE invoking git merge --ff-only <pinned SHA> IN PRIMARY. Do not checkout branches, fetch remote implicitly, reset or force.
2. Already integrated: pinned integrationSourceCommit is an ancestor of actual destination HEAD, AND the target checkout has the exact intended Spec tree/state. Additional unrelated destination commits may be accepted only with pinned evidence and no intervening replacement of Spec content.

Divergent histories, squash-equivalent patches without ancestry proof, merge conflicts, unknown Git process outcomes, changed HEAD/branch during admission and destination content mismatch are actionable blocks. An operator may resolve branch divergence OUTSIDE close, then retry with a new preview only if no lifecycle effects have begun; a persisted intent can never silently change its pinned source/destination. This sacrifices automatic merge convenience for a bounded recoverable effect. Remote push/PR state is not required nor implied: this is local integration only.

Git integration may update the primary HEAD and checkout files in a verified fast-forward; the prohibition is on implicit BRANCH SWITCHING, not on committed integration. A Git failure after process launch has unknown side effects until reconciled.

## Archive and commit policy

Engine MAY create exactly one narrowly scoped archive commit for Close Specification, after verified source preflight and any future exit actions, before integration. It does NOT commit arbitrary existing changes. Require clean source and destination before starting; after archive mutation, stage only the intended active-directory deletion and archive-directory addition, including all contents; before committing verify index contains exactly that intended path set, no unexpected stage. Commit message includes operationId (and original specId) for recovery, but metadata alone is not success: inspect parents, tree, manifest identity, archived directory and committed content. No engine-created commit on Worktree close.

A source filesystem move is recoverable from a journal with pre-mutation tree fingerprints and precise file inventory. Subsequent admission must recognize verified journal-owned staged archive files without requiring the worktree to be globally clean again. Never reset/overwrite, never assume rename is atomic across filesystems, and reject partial/changed effects that cannot be proven. If a future exit action changes files, the action must declare its write set and durable idempotency key; the narrowed commit scope must deliberately include verified action outputs, not expand to git add -A.

## Durable lifecycle record and checkpoints

Persist independently of Create under ignored Project Home state, e.g. engine/operations/spec-lifecycle/<operationId>.json. Typed discriminated kind = worktree-close | specification-close, schema version, project/git instance, specId, immutable normalized request fingerprint, source and target physical identities and HEADs, expected binding generation, source file manifest/fingerprint, original source HEAD, optional Engine archive-commit SHA (integrationSourceCommit), archive/exit evaluation facts, scope, evidence and stage.

Suggested phases:
- reserved (read-only preview completed, exclusive spec reservation published)
- gate-decision-recorded (only specification-close; explicit manual-not-evaluated or evaluated verified pass)
- actions-settled (future only; no speculative no-op provider)
- archive-initiated / archive-verified (specification-close only)
- archive-commit-initiated / archive-committed (specification-close only)
- integration-initiated / integration-verified (linked only)
- binding-initiated / rebound (linked only)
- removal-initiated / removed / registration-retired (linked only)
- completed or recovery-required

Stages are illustrative; the implementation must use a closed union with operation-specific legal transitions, not one permissive generic loop. Inspection and preview are read-only. Reserve and advance checkpoints under short project locks. Git and filesystem mutations occur OUTSIDE the lock, with a durable per-spec operation owner that blocks competing IDs; no lock is held over an external process. Re-read and CAS the registry before publishing rebind, advancing generation. A rebind may change the Spec binding while preserving linked registration temporarily; after verified Git removal retire registration ONLY if no binding or other dependency references it. Do not make a generic registry editing API public.

An operationId is idempotent only for identical intent; same ID with altered request => conflict; different IDs on same spec while pending => conflict. Same-ID retry while writer might be active can OBSERVE, never execute twice. Unknown process outcome requires documented trusted/manual recovery with positive quiescence evidence; do not infer from PID/TTL. Recovery after successful commit, merge, CAS or removal checks physical evidence and advances without redoing irreversible effects. Failure before any effects may be rejected cleanly; failure after an effect retains journal and never silently rolls back shared Git state.

## Crash matrix and side effects

- Before/after move: inspect both physical paths and pinned inventory; resume only on exact proof, otherwise recovery-required.
- After archive commit before integration: recognize the verified Engine archive commit/tree, record integrationSourceCommit distinct from preArchiveSourceHead and continue without a second commit.
- After merge before CAS: destination proof must match; CAS only on expected binding; external revision may change for unrelated specs but conflicting spec generation must block.
- After CAS before deletion: reads MUST resolve PRIMARY; journal records pending disposal; inspect safely before non-force removal.
- After remove before registry retirement: source registration can remain temporarily noncanonical; resume only when Git metadata proves original worktree is gone, then scoped retire. Source branch NOT deleted.
- Repeated archive close: return an already-closed result ONLY when authoritative archive and matching completed journal or fully verified closed state are proved; otherwise conflict/inspection, never create a second commit.

## Workflow seam and policy

Keep lifecycle distinct from future workflow domain. Plan 02 closes without evaluating tasks: unknown[] is opaque. Future integration receives a verified Spec identity, immutable workflow-definition/position revision (if available), operationId, physical source context and effect scope. Gate evaluation yields a discriminated result: not-installed | passed-with-evidence | blocked | unknown. Not-installed is NEVER passed. An installed/configured evaluator yielding unknown/blocked/missing definition MUST block before archive/commit/integration. Exit actions run AFTER verified gates and BEFORE archive commit, under the same lifecycle intent. Each action needs an idempotency/reconciliation contract and persisted per-action intent/result BEFORE any non-repeatable effect; unresolved action outcome blocks retry. No generic plugin registry, Task/Attempt or Session created now.

Foundation policy for explicit owner decision: before a Specification workflow evaluator exists, allow an authorized administrative archive only with a distinct explicit acknowledgement that no exit gates were evaluated; persist the FACT as exitEvaluation=not-configured and closureAuthorization=administrative. This is an explicit deterministic business operation, NOT a choice of workflow execution algorithm and NOT evidence of workflow completion. If a Specification evaluator is installed/configured, its unknown or blocked result cannot be bypassed by this acknowledgement. Approval is REQUIRED before this path becomes implementable. Worktree close NEVER invokes this policy.

## Proposed Engine / adapter interface

Transport-neutral application calls: previewCloseWorktree(specId, destinationBranch); closeSpecificationWorktree(input: {specId, operationId?, destinationBranch, expectedPreviewToken?, confirmExternalWritersQuiescent}); previewCloseSpecification(specId, destinationBranch?); closeSpecification(input: {specId, operationId?, destinationBranch?, acknowledgeAbsentSpecificationExitChecks?: true, confirmExternalWritersQuiescent?}). Names are candidates.

Typed result: operationId, kind, specId, sourceWorkspaceId, resultingWorkspaceId, resultingLocation ('active' | 'archive'), integration ('not-needed' | 'fast-forward' | 'already-integrated'), cleanup ('not-applicable' | 'removed'), exitEvaluation ('not-applicable' | 'not-configured' | 'verified'), verified primary HEAD/commit and binding generation. Separate inspect/status endpoint is strongly recommended for ambiguous in-flight operations. No false success for partials.

Stable error families: invalid_request, not_found, already_closed, unsupported_source, dirty, wrong_destination, divergent, blocked_by_operation, blocked_by_external_writer, failed_gate, unknown_gate, identity_mismatch, source_invalid, destination_mismatch, revision_conflict, recovery_required, git_uncertain, auth_forbidden. Exhaustive mappings: 400 malformed; 401/403 auth; 404 authorized genuinely absent; 409 conflicts/dirty/divergent; 422 unsupported declared operation or absent mandatory acknowledgement; 503 unavailable/recovery/unknown gate/outcome; unexpected faults stay 500. CLI prints typed JSON with nonzero exit; no filesystem paths in unauthorized responses.

Recommended routes: POST /api/specs/{specId}/worktree/close and POST /api/specs/{specId}/close, with read-only preview endpoints and operation inspection as needed; separate SpecCapabilities.CloseWorktree and CloseSpecification with validated project/spec scope. Verify target resource scope from trusted canonical lookup after authenticated admission; never derive grants from caller destinationBranch or workspaceId. Runtime and CLI call identical Engine use cases. Existing create scope is NOT authority to close.

## Explicit deferrals and compatibility

Deferred: custom merge/rebase/PR flows; unsafe unmanaged/shared cleanup; auto branch deletion; remote push; distributed fencing of arbitrary OS writers; session-native resume migration; Task/Attempt gates; workflow evaluator/action implementation. Plan 03 claims and Plan 04 Sessions will later strengthen close admission; they are not runtime dependencies for the explicitly limited Plan 02 close.

Test and gate mapping: see Plan 02 and lifecycle LC01–LC34 in test-plan.md. Before PR #53 merge promote approved persistent decisions out of this draft tree and delete temporary execution-plans as the runbook requires.
