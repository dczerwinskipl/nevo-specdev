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

Status: proposed for independent architectural review, NOT production authority. Updated for owner integration, project target-branch and manifest naming direction (2026-10-16); re-check HEAD before implementing.

## Verified code baseline and compatibility

- Engine exports createSpecificationFromRequest, discoverSpecifications, resolveSpecification; CLI owns specs create/list/resolve; Runtime owns POST /api/specs and GET /api/specs/overview.
- WorkspaceRegistry has primaryWorkspaceId, registration kind/managed/instanceId and SpecWorkspaceBinding.generation. registry-store intentionally rejects ANY rebind or workspace removal: implement a narrow, independently reviewed lifecycle transition, not a general relaxation of append-only registration.
- VersionControl.worktrees is an INTERNAL create-only port; the local Git client currently provides creation, worktree inspection and refs but no integration/commit/removal operations.
- Durable Create v2 records one creation intent, evidence checkpoints and manual interrupted-process confirmation. Reuse validated primitives and semantics, NOT creation journal schemas or flags.
- The legacy nevo workflow step finish is TASK/step/attempt-scoped. Its gate inspect/verify and action check/execute separation is reusable as an idea, but the legacy spec finalize invokes branch checkout/PR operations that are unsafe in linked worktrees.
- The deterministic workflow model is the ONLY SpecFlow workflow model. No Specification execution-mode selector is a domain concept. The current Engine scaffold has a redundant mode marker (implementation cleanup in E2.T09). Historic Create operation journals must retain byte-accurate replay of prior scaffold fingerprints even after new scaffolds omit that marker. No installed Specification workflow evaluator exists; neither scaffold metadata nor Task status is exit-gate evidence.

## Separate use cases and outcomes

Worktree close: only a Spec canonically bound to an exclusive, managed linked checkout; integrate its branch into the project-configured destination; prove destination content; CAS rebind specId to primary; remove managed worktree; PRESERVE Specification location/status (active OR previously archived). No spec exit gate/action, no archive. Thus an archived-but-retained linked Spec can be integrated/cleaned later. Closing primary, unmanaged, shared, missing or substituted checkout fails without mutation. Branch refs remain by default.

Specification close in primary: requires canonical available active Spec in verified primary; no branch integration or worktree creation/removal. After real current preflight/authorization, move full spec directory from specs/active/<slug> to specs/archive/<slug>, change manifest status to archived while preserving spec_id, create Engine-owned narrowly scoped archive commit, and verify unique archive record.

Specification close in managed linked checkout: SINGLE close-spec intent with immutable integrateToTargetBranch boolean (default TRUE, shown as a checkbox in UI). After current verified preflight, archive source in that checkout and create scoped archive commit. If TRUE: integrate into the configured target, verify archive/specId in PRIMARY, CAS rebind and safely remove managed worktree in the SAME intent. If FALSE: archive LOCALLY and complete, retain canonical binding, linked worktree and branch, expose archived state there; later Close Worktree can integrate/rebind/dispose. Never delete the only canonical copy or claim an unintegrated primary archive. The TRUE case is NOT two separately journaled user operations.

Final positive result means verified committed effect, stable identity, registry binding and SELECTED source disposition. Archive-only linked close is terminal with integration=deferred, cleanup=retained, and verified linked binding; integrated close completes only after required destination proof and cleanup. After a crash, a nonterminal journal may report integrated or rebound but cleanup-pending; do not emit completed success until evidence confirms every required stage.

## Admission and constraints

- Versioned project policy in verified Project Home .nevo/config.yaml MUST record validated git.integrationTargetBranch (e.g. main or develop); select it at init/configuration, never hardcode it or derive from cwd at close. Primary destination checkout MUST currently be on that configured branch; never switch it automatically. Save exact configured branch and config revision as immutable intent input; changed/missing value fails closed rather than retargeting. Capture pre-mutation destination HEAD and pre-mutation source HEAD, primary workspace ID, source workspace incarnation/branch, binding generation and registry revision as immutable INITIAL intent evidence. When Close Specification performs an Engine-owned archive commit, persist the NEW verified commit SHA as integrationSourceCommit; do not confuse it with preArchiveSourceHead. All later integration/retry checks use the verified integrationSourceCommit. Neither a branch string nor a workspaceId supplied by the caller authorizes a mutation.
- On FIRST admission source and destination must be in the same verified Git instance, have clean index and worktrees (including untracked files), and have no merge/rebase/cherry-pick/sequencer state. All author-authored changes and the initial scaffold MUST be committed before mutation. Refuse arbitrary dirty/staged/untracked files, not silently stage them. On RECOVERY of an already reserved close, classify only exact, journal-owned archive worktree/index mutations by saved inventory and hashes as recoverable; never rerun the initial global-clean gate blindly and never exempt unrelated dirty content.
- Only one canonically LINKED-BOUND Spec in a managed linked worktree; inherited manifests from the primary base are not additional occupants. Check that the source branch diff does not alter other Specifications' files and that no other explicit binding points to this linked workspace; refuse shared ownership or ambiguous source changes. Reject unmanaged linked worktrees, foreign registrations and unsafe path/identity substitution in this milestone. In primary, unrelated Specs may exist but no dirty files are tolerated. Prior to linked worktree removal, INVENTORY all ignored per-checkout files (particularly .nevo/local), not just git status: the expected Engine identity marker is allowed only if its bytes/identity match; any other retained ignored/user data blocks automatic removal. Do not discard local user config, execution records or untracked artifacts.
- Foundation checks ACTUAL installed evidence: unsettled Engine create/close journals, actual project coordination locks, Git/fs status, physical workspace identity and ignored data. Unsettled observed evidence blocks. No Specification exit evaluator, managed Session/Turn process list or external-writer claim authority is installed today: do not query invented actors, persist synthetic unknown owners, require meaningless operator quiescence attestation or claim absence of external writers. Document the real cooperative local-workstation limitation: existing checks do not fence arbitrary OS writers. Future Workspace Execution/coordination must add a real quiescence admission contract before worktree disposal when implemented.
- Validate canonical manifest and exactly one source record before archive; destination must have exactly the expected record after integration, in the SAME active/archive location for Worktree close and archive for integrated Spec close. Archive-only linked close verifies canonical linked archive, not unchanged primary. Check both locations, duplicate IDs/slugs, symlink safety and complete directory tree including ancillary files. A stale primary copy is NOT a fallback.
- Git capability disabled is a policy for NEW worktree creation; clean closing of an already managed worktree must use an explicit independently authorized close policy. Do not make a deleted config flag silently strand the worktree or implicitly grant cleanup.

## Project-targeted local Git integration policy (MVP)

The configured project development branch is the sole automatic destination: git.integrationTargetBranch in versioned Project Home .nevo/config.yaml (final YAML shape must match verified init/config parser). Choose or explicitly migrate it, never silently guess main/develop. Current primary checkout must be on that branch; otherwise actionable blocker. Release trains are deferred.

1. Already integrated: verify source commit ancestor AND physical destination Specification tree/status.
2. Fast-forward: if destination HEAD is ancestor of the pinned source commit, journal and advance verified primary HEAD by fast-forward.
3. Clean divergent merge: if histories diverged, prepare an ordinary merge in an Engine-owned ISOLATED integration checkout based on PINNED source and destination commits, not a dirty primary. A clean merge yields a persisted candidate commit with verified parents/content; journal evidence BEFORE fast-forwarding primary to that commit. Never silently include unexpected changes to other canonical Specification files; verify worktree identity, hook/signing policy, exact pinned trees, operation id and crash checkpoints. Unknown subprocess results are reconciliation-required, not blind retry.
4. Conflict: preserve PRIMARY unmodified and journal integration=requires-resolution with pinned base/source/target and conflicted paths. Future UX offers Resolve manually / Ask agent, via a separate authorized conflict-resolution capability; Engine itself never launches an agent or chooses changes. Any isolated conflict-resolution checkout has durable ownership/identity/cleanup policy. Later verified resolution may resume the SAME operation only under an explicit pinned-input reconciliation contract. Unexpected branch/commit change must block, never silently replan.

No implicit branch checkout, remote fetch/push, branch deletion, force, reset or rebase. The fully interactive agent/manual conflict-resolution UX is NOT implemented by Plan 02; its typed paused-result/provenance seam belongs here. Clean divergent merges EXPAND the previous ff-only design and MUST pass independent T11/T17 Git/crash/security review.

## Archive and commit policy

Engine MUST automatically create exactly one narrowly scoped archive commit INSIDE Close Specification, after current verified preflight and BEFORE optional integration. The user/agent/CLI/HTTP adapter does NOT stage/commit archive effects directly: all use the Engine operation. It does NOT commit arbitrary existing changes. Require clean source and destination before starting; after archive mutation, stage only the intended active-directory deletion and archive-directory addition, including all contents; before committing verify index contains exactly that intended path set, no unexpected stage. Commit message includes operationId (and original specId) for recovery, but metadata alone is not success: inspect parents, tree, manifest identity, archived directory and committed content. No engine-created commit on Worktree close.

A source filesystem move is recoverable from a journal with pre-mutation tree fingerprints and precise file inventory. The intent pins integrateToTargetBranch and verifies final canonical binding/location for both archive-only and integrated outcomes. Subsequent admission must recognize verified journal-owned staged archive files without requiring the worktree to be globally clean again. Never reset/overwrite, never assume rename is atomic across filesystems, and reject partial/changed effects that cannot be proven. When an actual Specification exit-action capability exists, it must define its own durable write set/idempotency/reconciliation evidence BEFORE integration; the scoped archive commit may include only independently proven action outputs, never git add -A.

## Durable lifecycle record and checkpoints

Persist independently of Create under ignored Project Home state, e.g. engine/operations/spec-lifecycle/<operationId>.json. Typed discriminated kind = worktree-close | specification-close, schema version, project/git instance, specId, immutable normalized request fingerprint, source and target physical identities and HEADs, expected binding generation, source file manifest/fingerprint, original source HEAD, optional Engine archive-commit SHA (integrationSourceCommit), configured project target and config revision, integrateToTargetBranch, conflict/integration-checkout ownership evidence when used, ACTUAL archive/commit/integration effects, scope, evidence and stage. Foundation writes no fake gate-decision, writer-quiescence proof or placeholder workflow status.

Suggested phases:
- reserved (read-only preview completed, exclusive spec reservation published)
- archive-initiated / archive-verified (specification-close only)
- archive-commit-initiated / archive-committed (specification-close only)
- integration-preparation-initiated / candidate-proven / requires-resolution / integration-initiated / integration-verified (linked only when integration requested)
- binding-initiated / rebound (linked only after verified integration)
- removal-initiated / removed / registration-retired (linked only after verified integration)
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

## Explicit future integration seams, without fake components

Plan 02 has NO installed Specification exit-gate evaluator/action runner, managed Session/Turn process service or external-writer coordinator. Ordinary close currently proceeds after REAL Engine preflight and authorization only. Do not create boolean admin-bypass flags, synthetic `not-configured`/`passed` results, `NoopWorkflowGateway`, `NoopWriterGateway`, plugin registries, speculative ports/DI or fake journal checkpoints.

**Application layer placement:**

1. In `specs/lifecycle/close-specification.ts`, immediately AFTER verified source/identity preflight and BEFORE the first archive filesystem effect, leave `// TODO(specification-exit): connect real Specification exit gates/actions owned by the future workflow slice here.` No callback, interface, no-op function or empty journal stage today. When the real workflow capability exists, its gate action contract must be designed with actual producer/consumer and fail closed on unknown/blocked, with durable effect/idempotency evidence.
2. In `specs/lifecycle/disposal.ts`, immediately BEFORE physical managed worktree removal, leave `// TODO(workspace-execution): connect real active writer/session/claim quiescence admission here when implemented.` Do not pretend to enumerate unimplemented processes. Real Git/index/filesystem/journal/identity blockers stay mandatory. Workspace Execution coordination, not Specification domain, will own future active writer claims and quiescence.
3. Git integration is a REAL capability required today and uses the existing VersionControl boundary extended by a narrow typed port. Project/Workspace registry CAS remains Project-owned; archive/close orchestration stays Specs-owned. Neither CLI nor Runtime performs direct Git/archive side effects.

These are comments/module ownership instructions only. Do not add new packages, registries, public result enums or interfaces until real feature owners and call sites exist. Later workflow/writer functionality receives its own implementation tasks and journal versioning when justified. Current tests assert real archive/commit, journal, identity, Git/data-loss safety and the ABSENCE of fake gate/writer request/response fields.
## Proposed Engine / adapter interface

Transport-neutral application calls: previewCloseWorktree(specId); closeSpecificationWorktree(input: {specId, operationId?, expectedPreviewToken?}); previewCloseSpecification(specId); closeSpecification(input: {specId, operationId?, integrateToTargetBranch?: boolean}). No fake exit-gate override or external-writer acknowledgement fields.. Names are candidates.

Typed result: operationId, kind, specId, sourceWorkspaceId, resultingWorkspaceId, resultingLocation ('active' | 'archive'), integration ('not-needed' | 'deferred' | 'fast-forward' | 'clean-merge' | 'already-integrated' | 'requires-resolution'), cleanup ('not-applicable' | 'retained' | 'removed' | 'pending'), verified primary HEAD/commit and binding generation. Separate inspect/status endpoint is strongly recommended for ambiguous in-flight operations. No false success for partials.

Stable error families: target_branch_not_configured, target_branch_not_checked_out, integration_requires_resolution, invalid_request, not_found, already_closed, unsupported_source, dirty, wrong_destination, divergent, blocked_by_operation, identity_mismatch, source_invalid, destination_mismatch, revision_conflict, recovery_required, git_uncertain, auth_forbidden. Exhaustive mappings: 400 malformed; 401/403 auth; 404 authorized genuinely absent; 409 conflicts/dirty/divergent; 422 unsupported declared operation; 503 unavailable/recovery/unknown Git/process outcome; unexpected faults stay 500. CLI prints typed JSON with nonzero exit; no filesystem paths in unauthorized responses.

Recommended routes: POST /api/specs/{specId}/worktree/close and POST /api/specs/{specId}/close, with read-only preview endpoints and operation inspection as needed; separate SpecCapabilities.CloseWorktree and CloseSpecification with validated project/spec scope. Verify target resource scope from trusted canonical lookup after authenticated admission; never derive grants from caller destinationBranch or workspaceId. Runtime and CLI call identical Engine use cases. Existing create scope is NOT authority to close.

## Explicit deferrals and compatibility

Deferred: custom rebase/PR flows; unsafe unmanaged/shared cleanup; auto branch deletion; remote push; distributed fencing of arbitrary OS writers; session-native resume migration; Task/Attempt gates; actual Specification exit gates/actions; workflow evaluator/action implementation. Do not simulate deferred capabilities in Foundation. Plan 03 claims and Plan 04 Sessions will later strengthen close admission; they are not runtime dependencies for the explicitly limited Plan 02 close.

Test and gate mapping: see Plan 02 and lifecycle LC01–LC40 in test-plan.md. Before PR #53 merge promote approved persistent decisions out of this draft tree and delete temporary execution-plans as the runbook requires.
