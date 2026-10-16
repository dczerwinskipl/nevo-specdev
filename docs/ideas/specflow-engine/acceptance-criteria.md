---
id: ideas.specflow-engine.acceptance
type: reference
title: Engine worktree foundation acceptance criteria
status: draft
scope: specflow
areas: [testing, docs, cli, workflow, runtime]
tags: [acceptance, proof-of-concept, requirements]
read_when:
  - deciding whether the engine/worktree PoC proved its architecture
  - freezing documentation or approving migration of legacy workflow
summary: >
  Separate evidence-based acceptance gates for Specs/workspace Foundation A, real workflow
  coordination Foundation B, and later Runtime-managed Sessions integration.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.spec-creation
  - ideas.specflow-engine.test-plan
  - ideas.specflow-engine.decisions
  - ideas.specflow-engine.managed-session-integration
  - ideas.specflow-engine.execution-scopes
---

# Acceptance criteria — staged proposal

These are **candidate** gates, not adopted production contracts. An implementation is accepted only with executable test IDs, revision/OS evidence and explicit owner sign-off. A `draft` documentation PR cannot claim a passed runtime gate.

## Foundation A — Specs, Project Home, Git Workspaces (first PoC)

**Boundary:** real Spec create/list/read from offline CLI and authenticated HTTP, project/workspace source identity, Git worktree provisioning, registry, creation journal and project/registry mutation serialization. **No workflow start/finish, external execution lease, provider Session or fake workflow API is required to pass A.**

| ID   | Acceptance                                                                                                                                                                               | Required evidence                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| FA01 | Runtime stopped: separate CLI processes create/list/resolve a title-only Specification                                                                                                   | C01, C04, C10; verify process runs with HTTP Runtime absent                                                     |
| FA02 | CLI and authenticated HTTP call one application use case; production returns real data without fixture fallback **and sees offline mutations while Runtime remains running**             | H01–H06, architecture/import check; H03 must warm read cache then refresh/re-read without restart, SSE optional |
| FA03 | Git feature disabled rejects new worktree **before side effects**; ordinary supported Git-backed Spec create still works                                                                 | C03 + negative-side-effect snapshot                                                                             |
| FA04 | Enabled Git creates one verified branch/worktree with untouched primary HEAD/files                                                                                                       | C02, C06, C12                                                                                                   |
| FA05 | Primary and linked checkout resolve identical Project Home/local config/registry; independent clone is separate; linked committed config cannot silently override home-owned policy      | C10, C11, P01–P04, P06                                                                                          |
| FA06 | Registered spec has one canonical source; duplicate manifest doesn't duplicate row; missing binding/worktree is not silently read from main                                              | C07–C09, P05                                                                                                    |
| FA07 | Concurrent OS processes serialize spec/branch/registry reservation; no lost update or destructive rollback                                                                               | L01, L02, L07                                                                                                   |
| FA08 | Crash at each create stage can resume safely, or report actionable ambiguity, with no duplicate spec/worktree and stable idempotency                                                     | C05, R01–R05                                                                                                    |
| FA09 | Versioned config/local state, path safety and HTTP permissions fail closed; portable Auth grants do not use workstation-local workspace IDs; no invented Runtime Session or shadow state | H06, H08, H10, C09, C12                                                                                         |
| FA10 | Known creation scaffold/dirty baseline is documented so later authoring admission need not treat Engine-created files as unknown changes                                                 | baseline evidence + design test SC01, not automatic workflow migration                                          |
| FA11 | One installed product CLI remains; Engine has no HTTP/provider/Commander dependency; Windows and POSIX critical Git/process tests run                                                    | build/import checks; platform result                                                                            |
| FA12 | Scope, tradeoffs and unsupported cases are recorded; PR #45 is preview only and all docs/index checks are valid                                                                          | decision report; `pnpm docs:check`                                                                              |

**Foundation A acceptance does not imply that workflow or managed agent execution is ready.** If the Project Home mechanism relies on a specific checkout layout, record that supported scope explicitly and prove repair/missing-home behavior; no silent reinitialization.

## Foundation A lifecycle extension gate (new, separate from FA01–FA12)

This is a proposed **additional**, owner-approved Plan 02 exit gate. The already accepted Foundation A create/read contract is NOT retroactively redefined. Distinguish worktree close (spec remains active) and Specification close (archive).

| ID | Mandatory outcome | Evidence |
| --- | --- | --- |
| FL01 | Linked managed worktree closes only after actual local integration, destination tree verification and CAS; spec remains active | LC01, LC05, LC07–LC18 |
| FL02 | A worktree-closed spec can be closed later in the primary without another merge | LC02, LC04 |
| FL03 | Linked and primary Specification closure put one stable specId in verified archive and automatically produce EXACTLY ONE Engine-owned, scoped archive commit without requiring a user/agent commit | LC03–LC05, LC19–LC22, LC27, LC32, LC38 |
| FL04 | Distinct durable operation kind/intent, idempotency, cross-process exclusion and honest unknown outcome recovery | LC17–LC23 |
| FL05 | Offline CLI and explicitly authorized HTTP parity; live canonical reads after CLI mutation | LC06, LC25, LC28 |
| FL06 | Known unsettled Engine journals/locks, unsafe Git/filesystem/workspace identities and branch states refuse; no fake external-writer proof, forced cleanup or implicit branch checkout | LC09–LC16, LC23, LC26, LC29 |
| FL07 | No speculative workflow gateway/registry, gate pass or no-evaluator admin bypass; real close runs after actual preflight. Explicit future workflow and workspace-execution TODO checkpoints, no fake active-process verification | LC24 plus domain review |
| FL08 | Critical real Git/filesystem/process tests PASS on Windows and POSIX with no mandatory skips | LC01–LC05, LC07–LC23, LC26–LC27, LC29–LC33, LC35–LC40 |
| FL09 | New Specification scaffold has no execution mode discriminator or change-log filename, while old Create journals retain safe original replay | LC30, LC34–LC36 |
| FL10 | Ignored local user files never vanish during disposal; archive integration uses proven post-archive HEAD and scoped replay | LC29, LC31–LC33 |
| FL11 | Configured integration target is authoritative; local-only archive retains linked canonical source; later close-worktree integrates it | LC37–LC38 |
| FL12 | Conflict-free divergent merge is verified and recoverable; conflicted merge pauses without mutating primary or fabricating agent actions | LC39–LC40 |

Gate follows owner-confirmed [DC03/DC04/DC05/DC08/DC10/DC16](specification-close-decisions.md) and required independent Git/crash/quality review. No Plan 03 E3.T06 dependency is required for the restricted closure policy; future actual writer claims and managed Sessions strengthen admission when they exist. Do not claim a clean tree or operator assertion physically proves absence of non-cooperating external writers. No permanent adoption of these draft requirements until independent architecture review and promotion to normative docs.

## Foundation B — Execution coordinator + one real minimal Workflow Kernel

**Boundary:** no provider, no full old Nevo workflow; one representative real deterministic step start/finish, actual attempt identity, effects-based admission, and independent CLI processes. Do **not** satisfy these by a mock endpoint with no workflow state.

| ID   | Acceptance                                                                                                                                                                         | Required evidence                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| FB01 | External CLI with Runtime off can inspect/start/finish one real deterministic workflow attempt without fake Session                                                                | W01, W02                                    |
| FB02 | Writer scope is independent of Task/Turn; spec authoring may hold writer without taskId; enforced read-only work does not                                                          | W03, W04, SC01                              |
| FB03 | Claim outlives short CLI process; concurrent writer blocked; nonconflicting worktrees proceed                                                                                      | L03, L04, W05                               |
| FB04 | Release/settlement does not automatically finish Task; explicit finish and attempt-scoped evidence control progression                                                             | W02, W06                                    |
| FB05 | Inspect/reconcile/owner release expose actionable recovery and can automatically clear **proven** settled work; ambiguity escalates rather than blocks silently forever            | L05, L06, W07, W08                          |
| FB06 | External actor trust and human gate provenance are a documented owner decision; arbitrary owner/role/session string cannot self-approve                                            | W09, AG01–AG03, security review             |
| FB07 | Dirty-state admission distinguishes known scaffold from unrelated edits without disabling required clean-tree gates                                                                | SC01, SC02                                  |
| FB08 | No provider/HTTP dependency, import directions and cross-process replay evidence hold after Kernel integration                                                                     | separate-process test run; dependency check |
| FB09 | Workflow attempt is bound to the verified definition revision resolved from its execution workspace; changed HEAD/home/worktree definition cannot silently reinterpret the attempt | W10 + mismatch/recovery evidence            |

**Foundation B pass** means safe offline workflow coordination primitives exist; it does not certify Sessions or provider migrations.

## Sessions Foundation and Managed Execution integration (later independent gate)

Sessions Foundation can be developed against the contract independently of full workflow migration. Managed integration tests require **Foundation B's real coordinator** and a mock provider; actual external providers follow later.

| ID   | Acceptance                                                                                                                             | Required evidence      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| SI01 | Canonical product `sessionId` distinct from provider-native `ProviderSessionRef`; stable historical Session/Turn/Work read             | S01 + persistence test |
| SI02 | Standalone read-only/ad-hoc Session Turn works without workflow or writer claim when mode genuinely enforced                           | S01                    |
| SI03 | Writable managed Turn uses Engine admission/claim and persists dispatch intent with current workspace root                             | S02                    |
| SI04 | Terminal Turn or handover does not automatically complete/activate a workflow step; batch retains explicit per-Task scope              | S03–S05                |
| SI05 | Crash before/during/after provider dispatch does not duplicate unknown tool effects, and settles only proven ownership                 | S06                    |
| SI06 | Move/rebind/unavailable worktree invalidates unsafe native resume while preserving authorized Session history                          | S07                    |
| SI07 | Scoped Session and Spec/Workspace reads don't leak records through cross-feature projections                                           | S08                    |
| SI08 | Writer claims can be reconciled independently of provider Session/Turn lifecycle; external work is not fabricated as a managed Session | S02, S06, W08          |

## Deferred follow-up gate — multi-instance execution

The [multi-instance idea](multi-instance-execution.md) and its [future implementation plan](multi-instance-plan/README.md) are **not** part of FA01–FA12, FB01–FB09 or SI01–SI08. Foundations must preserve `one workflow attempt != one Session/Turn` without implementing instance orchestration. MI01–MI12 in the [test matrix](test-plan.md) should eventually prove user-defined steps/instructions/result reducers, effect-scoped admission, post-activation input consistency where required, independently recoverable contributions and one aggregate finish. Read-only review is a test case, **not** an Engine step type; task batches do not count as multi-instance proof.

## Deferred rather than falsely accepted

Full provider migration, richer prompts/composer, complete deterministic gate set, Task batch orchestration, automatic Session handover, GitHub/GitLab integration, full finalize, worktree removal UI, multi-machine/network filesystems and strong security against unrestricted same-OS-account adversaries are **not** required by Foundation A/B. Every deferral must identify the future owner and safety boundary; no exposed feature may claim deferred behavior works.

## Promotion / no-go

Freeze normative ADR/architecture only after **both relevant Foundation gates pass** and owner selects Project Home policy, claim recovery, local actor/human approval trust, binding rebind behavior, and import/package shape. Migrate managed Sessions only with an agreed handshake contract. No-go: Runtime is needed for ordinary CLI workflow, a duplicate provider invocation is replayed under unknown outcome, an external claim auto-releases on PID/TTL alone, unauthorized human approval is accepted, or a canonical spec silently falls back to stale main data. Link all accepted choices to real tests and PR commits.
