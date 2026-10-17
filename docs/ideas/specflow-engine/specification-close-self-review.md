---
id: ideas.specflow-engine.specification-close-self-review
type: engineering
title: Self-review of Specification and Worktree closure design
status: draft
scope: specflow
areas: [workflow, security, testing]
tags: [architecture-review, self-review, lifecycle, temporary-design]
read_when:
  - independently reviewing E2.T09–T17
  - checking corrected design weaknesses before code implementation
summary: >
  Explicit internal review findings and correction evidence against the 2026-10-16 planning design.
related:
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.specification-close-decisions
  - ideas.specflow-engine.plan-02
---

# Self-review: Plan 02 Specification & Worktree closure

**Scope:** architectural/doc/task design only. The reviewer is the original design author: NOT an independent review and NOT verified runtime implementation. Examined git HEAD 123830e, current Engine scaffold/create/journal/registry/version-control code, old Nevo deterministic Task workflow and draft Plan 02 docs on 2026-10-16. The corrected task plan still requires a separate architecture approval before execution.

## Findings and changes

| ID   | Severity | Finding                                                                                                                                                                                                                                                          | Corrective action                                                                                                                                                       | Follow-up                |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| SR01 | P1       | Redundant workflow execution-mode field in new Spec manifest. The sole SpecFlow workflow architecture is deterministic. Its presence implied an artificial choice.                                                                                               | E2.T09 now removes the marker from new scaffold; docs define no alternative algorithm.                                                                                  | Test LC34                |
| SR02 | Superseded: the original review assumed unfinished unreleased Create v1/v2 journals needed byte-for-byte migration compatibility | Owner clarified no released version/real user data to preserve; T09 removes prototype paths, retains current contract SIGKILL/CAS/fingerprint recovery | LC30, LC36 |
| SR03 | P1       | Linked Spec close creates an archive commit, so original pinned source HEAD is not the commit that must be integrated. Earlier proposal did not make this change-of-HEAD explicit.                                                                               | Persist preArchiveSourceHead and independently evidenced integrationSourceCommit, keep both in journal; integrate exact new SHA.                                        | LC32                     |
| SR04 | P1       | Ordinary git status does not inventory ignored per-checkout files; managed worktrees have an ignored .nevo/local/state/workspace-identity.json and might have user state/config/artifacts. Removing checkout without inspecting ignored files risks silent loss. | Before disposal inventory ignored state, whitelist only original verified Engine marker, block other ignored local data. No force removal.                              | LC29                     |
| SR05 | P2       | An interrupted archive may leave exact Engine-owned staged files. Blindly re-running global-clean preflight makes supported journal recovery impossible.                                                                                                         | First admission requires clean tree; recovery validates only pinned journal-owned file inventory/staged changes, all unexpected changes block.                          | LC33                     |
| SR06 | P2       | Windows has no POSIX SIGKILL semantics identical to Unix, although process-level crash proof is still required.                                                                                                                                                  | Require forcible OS process termination with actual confirmed process exit and stage proof on Windows, SIGKILL on POSIX.                                                | T17 LC19–LC23 and LC33   |
| SR07 | P2       | Earlier design/test prose said LC01–LC24 although 28 cases were published.                                                                                                                                                                                       | Fixed inconsistent range and later extended matrix to LC01–LC40.                                                                                                        | Static consistency check |
| SR08 | P2       | Generated Spec/docs indexes might become stale after an archive even if they are not canonical read authority.                                                                                                                                                   | T14 explicitly requires inspecting actual index contract and journaled path-scoped regeneration when required, not global add -A.                                       | T14 independent review   |
| SR09 | P2       | T09 optional cleanup carried a Plan 03 writer-claim dependency inconsistent with Foundation-only closure; after moving closure to T10–T17 the placeholder was misleading.                                                                                        | Replace T09 with narrow manifest contract/recovery task; no dependency on E3.T06.                                                                                       | Review plan graph        |
| SR10 | Decision | There is NO current Specification exit evaluator, so a fabricated pass, administrative bypass or not-configured status would invent an absent feature.                                                                                                           | Explicit TODO before archiving for future Specification-workflow gates/actions; no evaluator/registry/gateway/acknowledgement fields now.                               | DC08 approved            |
| SR11 | Decision | Clean Git/index cannot physically prevent a non-cooperating OS writer and operator declarations don't prove quiescence.                                                                                                                                          | Check installed Engine journals/locks/Git/fs only; explicit TODO before disposal for future Workspace Execution coordination. No fake writer service or assertion flag. | DC10 approved            |

## Source-of-truth and consistency checks

- T09 removes the redundant mode marker, legacy scaffold renderer and obsolete Create journal formats as a single pre-release contract cleanup; the actual release-readiness gate remains real filesystem/Git recovery.
- create-scaffold.ts.expectedScaffold continues to verify immutable scaffold hashes for the **current** journal; obsolete records fail closed instead of being migrated.
- Linked workspace physical identity marker is written to ignored .nevo/local/state/workspace-identity.json by workspace-identity.ts, proving the ignored-data disposal problem is relevant to this repository.
- Registry store currently prohibits rebind and registration removal; T12 must introduce narrowly fenced lifecycle CAS without altering arbitrary create transitions.
- Future Specification exit evaluation must never derive completion from tasks: unknown[] nor introduce a selectable execution mode. Task workflows in legacy Nevo are reference material only.
- The generated closure design must be checked against docs/architecture/workflow/deterministic-workflow.md before architectural promotion. No claim that the new spec-level workflow evaluator exists today.

## Owner refinements (2026-10-16)

- DC03/DC18: recorded project development branch git.integrationTargetBranch in Project Home config, not per-close branch guess.
- DC04/DC17: automatic verified conflict-free divergent Git merge as well as fast-forward. A true merge conflict yields requires-resolution evidence in isolated checkout; user/agent UX is a SEPARATE future capability, never invoked by Engine.
- DC15: linked Specification close supports integrateToTargetBranch (default true); false archives locally and retains linked binding/worktree for later Close Worktree, including when Spec is already archived.
- DC16/DC26: only specification.yaml and one current Create journal are valid. Unreleased change.yaml/v1 artifacts fail closed; no automatic migration, no weakening of crash safety. T09 owns the contract refinement.
- NEW review risk SR12 (P1): isolated clean merge has substantial Git commit/journal identity/hook/temporary-checkout ownership complexity and must not mutate primary before verified candidate. T11/T17 independent review must test crash after candidate commit, after publish and during conflict.
- NEW review risk SR13 (P1): linked archived-without-integration is NOT present in primary; registry binding and canonical document read must stay linked until later explicit integration/rebind. Never delete that worktree as a side effect of archive-only close.

## Final owner direction — explicit seams and Engine-owned archive commit

- DC05: archive filesystem move + exactly-one scoped commit belongs inside Engine Specification-close durable operation; never a separate action delegated to user, agent, CLI or HTTP.
- DC08: leave `// TODO(specification-exit): ...` in Specs lifecycle application orchestrator immediately BEFORE archive effect. Future workflow slice owns actual gates/actions; do not build fake interfaces, registry, no-op implementations, statuses or administrative bypass now.
- DC10: leave `// TODO(workspace-execution): ...` in Specs lifecycle disposal boundary before irreversible worktree removal. Future Workspace Execution feature owns process/session/claim quiescence, not a fake Foundation check. Current installed journal/lock/Git/fs blockers remain in place. No physical fencing guarantee against arbitrary OS writers.

## Additional P1/P2 self-review findings — implementation admission

- **SR14 P1 — parser/ordering:** Existing `parseGitWorktreePolicy` rejects `git.integrationTargetBranch`, `git.enabled` is compulsory when `git` present, and CLI init only writes runtime config. The T10 consumer must FIRST own parser and migration behavior, while T16 owns init UI; do not conflate worktree-create enablement with integration permission.
- **SR15 P1 — authorization:** whole-branch merge can carry changes to code and project auth config; `CloseSpecification` per-Spec privilege cannot implicitly authorize repo-wide merge. T16 needs separate project-wide integrate authorization and full diff scope, and sensitive configuration protection.
- **SR16 P1 — conflict recovery:** source archive commit is done before integration, so a conflict occurs AFTER an irreversible archive. Must retain canonical linked archive, allow safe operator recovery/later CloseWorktree, and not permanently hold an unfinishable per-spec journal or delete unverified merge scratch state.
- **SR17 P2 — primary branch:** direct primary Spec close is not a merge but still creates a commit; only run it on the configured target branch, otherwise archived spec could end up on wrong branch.

## Independent review follow-up — 16 October 2026

The separate reviewer accepted the architecture direction but requested changes to T10–T17. Newly verified risks:

- **IR01 P1:** the original per-spec journal does not exclude two different Specs editing the same primary index/HEAD or a new Create starting after Close checks journals. T10 must coordinate actual durable shared Git/checkout/ref resources, with Create participating.
- **IR02 P1:** `git update-ref` alone can leave primary HEAD and working tree/index inconsistent. T11 must publish candidate commits using a Git operation that updates checked-out HEAD/index/files and prove/recover all three after crash.
- **IR03 P1:** post-archive conflict requires a true settled retained-linked outcome and resource release after proof, not merely a `requires-resolution` string that permanently blocks later CloseWorktree.
- **IR04 P2:** linked archive-only has no target-branch admission requirement; primary and integrated linked close do.
- **IR05 P2:** T12 may inspect its OWN nonterminal journal when in the correct disposal stage; reject competing owners, not the current operation itself.
- **IR06 CI:** on 7d39440, Quality failed at Prettier check for 10 Markdown files before lint/docs checks could run. Formatter and a full fresh Quality rerun required. Other reported workflows passed.

This follow-up is independent-review feedback translated into tasks; there is still NO code implementation of closure and no completed LC acceptance claim.

## Residual risks / explicit non-goals

1. Verified automatic conflict-free merge commits in a durable isolated checkout are included in owner direction DC04; rebase, squash-equivalence, PR/remote push and branch deletion remain deferred. Independent Git recovery review required.
2. A managed worktree with unexpected ignored files or another canonical binding cannot be automatically removed. Source integration/rebind and later cleanup recovery are distinct observed states, never fake success.
3. Current Foundation cannot physically fence a hostile/same-OS-account process; this remains an owner security decision before enabling removal. A PID, TTL, clean tree or arbitrary caller claim is insufficient.
4. Future workflow exit actions may be non-idempotent. Their installed implementation MUST durably pin action intent/inputs and reconcile before replay. The seam is reserved, no action engine built now.
5. No implementation tests have yet been executed for these NEW close tasks; LC01–LC40 are acceptance requirements, not PASS claims. No independent agent reviewed this design.

## Recommended next check

Independent architecture reviewer should focus first on SR02–SR05, DC05/DC08/DC10, then audit E2.T09, E2.T10, E2.T11, E2.T12 and E2.T14 contracts before permitting E2.T13/T15 functionality. Recheck HEAD, code paths, documentation references and tests, and stop if a material contract mismatch is found.
