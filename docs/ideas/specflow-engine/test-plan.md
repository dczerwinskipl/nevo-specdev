---
id: ideas.specflow-engine.test-plan
type: engineering
title: Engine workspace integration test plan
status: draft
scope: specflow
areas: [testing, workflow, runtime, cli, security]
tags: [integration-testing, git, worktree, concurrency, recovery]
read_when:
  - designing a proof-of-concept test suite for offline CLI and worktree Specs
  - investigating crash consistency or cross-process state
summary: >
  Executable matrix using real temporary Git repositories, offline child processes,
  HTTP integration and fault injection to validate Engine/Runtime/worktree boundaries.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.spec-creation
  - ideas.specflow-engine.locking
  - ideas.specflow-engine.recovery
  - ideas.specflow-engine.acceptance
  - ideas.specflow-engine.managed-session-integration
  - ideas.specflow-engine.execution-scopes
  - ideas.specflow-engine.project-home
---

# Test plan

## Evidence standard

A passing mock repository/DI unit test **does not** prove actual Git worktree behavior or cross-process locking. Use real temporary Git repositories, real CLI child processes and actual Fastify HTTP endpoints. Fake clocks/IDs are appropriate for deterministic unit tests; filesystem and Git must be real in boundary integration tests. Run on Windows and a POSIX CI runner, using paths with spaces and non-ASCII characters. Isolate Git user identity/config and default branch per fixture. Never access or mutate the developer's real Git repo.

For each case capture: setup, command/API, machine-readable result, files/refs/registry state, side-effect count, and cleanup verification. Failure tests must establish _absence_ of unintended effects.

## Layers and explicit gates

**Foundation A** owns C01–C12, L01/L02/L07 (registry/control locks only), R01–R05, H01–H06/H08/H10, P01–P06 and SC00 (known scaffold classification only). **Foundation B** owns L03–L06, W01–W10, H07, AG01–AG03 and SC01–SC02; it needs a real minimal workflow step, not a fake acceptance endpoint. **Sessions integration** owns R06, H09 and S01–S08. **Binding lifecycle** owns B01–B04 after managed execution; R07 belongs to later complete deterministic workflow migration. None of these are Foundation A preconditions. OS/platform evidence applies to all stages when implemented.

1. **Pure/domain:** validation, id/slug collision rules, read projections, location binding precedence, error taxonomy, transition/idempotency planning.
2. **Filesystem+Git integration:** real `git init`, initial commit, `git worktree add/list/remove`, inspect membership, branch and dirty state.
3. **Separate-process coordination:** spawn independent Node/CLI processes with barrier synchronization, kill one at injected stage.
4. **Runtime HTTP integration:** authenticate/authorize, invoke real feature endpoint and Engine-backed repository; check readable data without frontend fixtures.
5. **Optional UI smoke:** feature API + create form, title-only, capability-conditioned worktree switch, refresh of Overview/Workspace.

## Creation and discovery matrix

| ID  | Scenario                                                   | Expected                                                              |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| C01 | CLI create in primary with Runtime off                     | One valid manifest; returned specId resolves                          |
| C02 | CLI create new worktree with Git enabled                   | Exactly one branch, linked worktree, registry binding, valid manifest |
| C03 | Git integration disabled + `new-worktree`                  | Structured capability failure; no branch, path or registry write      |
| C04 | Only title given                                           | Generated slug and identity, valid default scaffold                   |
| C05 | Repeat same operation ID                                   | Exact same resource/result; no duplicate                              |
| C06 | Two specs in separate worktrees                            | Distinct roots; isolated uncommitted edits                            |
| C07 | Same specId manifest in main and bound worktree            | One visible spec; bound worktree wins                                 |
| C08 | Bound worktree removed out-of-band                         | Explicit unavailable/repair state; no silent primary fallback         |
| C09 | Duplicate/conflicting binding or corrupt registry          | Fail closed; no overwrite                                             |
| C10 | CLI invoked from linked worktree                           | Resolves same project home and local registry                         |
| C11 | Another clone shares remote URL                            | Not implicitly adopted into same local project                        |
| C12 | Space/non-ASCII paths, branch exists, symlink substitution | Correct handling/explicit conflict; no wrong directory mutation       |

## Project Home and binding provenance (Foundation A)

| ID  | Scenario                                                                      | Expected                                                                                                                                      |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| P01 | CLI from primary and registered linked checkout                               | Same projectId, registry/state/config owner, distinct workspace IDs                                                                           |
| P02 | Two home markers or home missing                                              | Explicit ambiguity/unavailable, no empty-project reinitialization                                                                             |
| P03 | Explicit home locator points to unrelated Git common-dir                      | Rejected even with supplied absolute path                                                                                                     |
| P04 | Independent clone with same remote URL                                        | Separate local state, no shared claim/registry                                                                                                |
| P05 | Bound worktree unavailable but same-id manifest in primary                    | Unavailable source, no stale fallback                                                                                                         |
| P06 | Primary and linked checkout contain different committed project configuration | Runtime and CLI consistently use designated Project Home operational policy and local config; linked branch does not override Auth/Git policy |

## Initial creation baseline

| ID   | Stage | Scenario                                      | Expected                                                                                |
| ---- | ----- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| SC00 | A     | Create scaffold, persist provenance           | Machine-readable known files/fingerprint; unknown dirty state not automatically trusted |
| SC01 | B     | Start spec authoring immediately after create | Known Engine scaffold can be admitted for writing under action policy                   |
| SC02 | B     | Unrelated dirty edits or clean-tree gate      | Correct explicit blocker/remediation; no global dirty bypass                            |

## Concurrency and crash matrix

| ID  | Scenario                                                                          | Expected                                               |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| L01 | Two OS processes create same slug/branch simultaneously                           | One success and one explicit conflict; unique registry |
| L02 | Concurrent creates with distinct specs                                            | Both persist; no lost JSON update                      |
| L03 | CLI finishes `start`, agent simulated still writing, Runtime tries same workspace | Claim blocks conflicting Engine writer after CLI exits |
| L04 | Separate worktrees concurrently claimed                                           | Independent work can proceed                           |
| L05 | Wrong owner token/identity attempts finish/release                                | Refused; claim unchanged                               |
| L06 | Stale claim with unknown external agent outcome                                   | Recovery-required; no auto-steal                       |
| L07 | Corrupt lock file                                                                 | Fail closed and provide diagnostic                     |
| R01 | Kill after intent/reservation                                                     | Retry recovers or unwinds without duplicate            |
| R02 | Kill after Git worktree create                                                    | Retry verifies and resumes; no second worktree         |
| R03 | Kill after manifest before registry                                               | Verified re-link to original spec ID                   |
| R04 | Kill after registry before response                                               | Same result returned on retry                          |
| R05 | External file changes during recovery                                             | Explicit conflict; no delete/overwrite                 |
| R06 | Runtime shutdown during managed operation                                         | Own resource settles; external claims not confiscated  |
| R07 | Process restarts with an interrupted workflow finish (later migration)            | No duplicated stage or attempt                         |

## Minimal real workflow and claim recovery (Foundation B)

| ID  | Scenario                                                                                      | Expected                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| W01 | Separate CLI starts actual simple deterministic workflow with Runtime stopped                 | Real attempt identity, not mock or Session                                                                                                          |
| W02 | Separate CLI finishes same step                                                               | Explicit transition/evidence, no implicit next start                                                                                                |
| W03 | Spec Writer scope with no taskId                                                              | Workspace writer claim allowed when effects require it                                                                                              |
| W04 | Enforced read-only analysis                                                                   | No writer claim; if write restriction unproven, fail conservative                                                                                   |
| W05 | Claim survives command termination                                                            | Other competing writer blocked, different worktree may proceed                                                                                      |
| W06 | External execution settles/releases without a Runtime Turn                                    | Release does not finish active workflow attempt                                                                                                     |
| W07 | Proven terminal external execution, valid journal                                             | Inspect then safe reconcile + CAS release; workspace unblocked                                                                                      |
| W08 | Abandoned/unknown external writer                                                             | Actionable inspection, safe owner release or explicit escalation; no TTL/PID theft                                                                  |
| W09 | Wrong owner/role or agent-supplied human review                                               | No forged human approval, even when valid claim exists                                                                                              |
| W10 | Active attempt created under workflow definition v1; workspace definition later changes to v2 | Inspect/resume/finish uses pinned verified v1 evidence or blocks for explicit compatible migration; never silently adopts v2 or Project Home's HEAD |

## Operator identity and human approval policy

| ID   | Scenario                                                            | Expected                                                                             |
| ---- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| AG01 | Agent uses CLI human confirmation without independent trusted actor | No privileged approval under secure policy                                           |
| AG02 | Human gate evidence from previous attempt or another task/gate      | Rejected; no evidence bleed                                                          |
| AG03 | Shared OS-account agent with full file access                       | Threat model explicitly states advisory—not adversarial—security; no false guarantee |

## HTTP/observability and security

| ID  | Scenario                                                                               | Expected                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H01 | Offline CLI create then start Runtime and GET Overview/Workspace                       | Same canonical spec, correct root                                                                                                                                  |
| H02 | HTTP create then stop Runtime and invoke CLI                                           | Same manifest and registry visible                                                                                                                                 |
| H03 | CLI modifies spec while Runtime runs and a previous HTTP read populated cache          | Subsequent supported HTTP refresh/re-read exposes updated canonical source without Runtime restart; on-demand refresh/invalidation suffices, SSE not required      |
| H04 | Missing production source                                                              | Honest 503/unavailable, never demo fallback                                                                                                                        |
| H05 | Demo mode                                                                              | No writes to production Git/registry                                                                                                                               |
| H06 | Unauthorized create/worktree request                                                   | 401/403 as relevant, zero side effects                                                                                                                             |
| H07 | External agent progresses Engine workflow                                              | Workflow state visible, no fabricated managed Session                                                                                                              |
| H08 | Invalid file/document ID or target path escapes workspace                              | Rejected without path disclosure/read/write                                                                                                                        |
| H09 | Scope-limited user accesses Session references in spec projection                      | Unauthorized Session data redacted/forbidden                                                                                                                       |
| H10 | Committed Authorization policy names a workstation-local workspaceId as portable grant | Product/resource scope validation rejects unsupported nonportable grants; stable specId/project-level grant is resolved to current bound workspace at request time |

## Managed Sessions integration (later gate, mock provider)

| ID  | Scenario                                                            | Expected                                                                                |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| S01 | Standalone managed Session/Turn without Task workflow               | Stable product sessionId, read-only mode needs no writer, history reload-equivalent     |
| S02 | Managed writable Turn performing one Engine Task step               | Current resolved cwd, writer claim + persisted invocation intent, deterministic release |
| S03 | Turn settles terminal before explicit workflow finish               | Task stays unfinished, no automatic reviewer Session                                    |
| S04 | One Session performs explicit Task batch sequentially               | Per-Task attempt identity and current execution scope, no historical binding ambiguity  |
| S05 | Handover creates successor Session                                  | Explicit lineage/context; no silent claim transfer/step advance                         |
| S06 | Crash at prepared, dispatching, spawned-but-not-correlated, started | No duplicate dispatch under uncertain outcome; positive evidence for safe replay only   |
| S07 | Workspace root moved/rebound/missing then new Turn resumes          | Revalidate binding/current cwd/native compatibility; preserve readable history          |
| S08 | Limited HTTP actor reads Session/Task/Specs projections             | Scoped redaction/403/404 without cross-resource leakage                                 |

## Binding change and cleanup (later gate)

| ID  | Scenario                                                | Expected                                                         |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| B01 | Merge content into destination, rebind canonical source | Destination verified, CAS binding generation, one canonical spec |
| B02 | Merge claimed but destination files stale               | Explicit rebind conflict, no cleanup                             |
| B03 | Active Turn or unresolved writer during rebind          | Operation blocked/reconciled; history unaffected                 |
| B04 | Worktree manually removed/moved then reattach           | Verify Git membership and identity; no guessed main fallback     |

## Finalization/cleanup probes (later slice, design must accommodate)

| ID  | Scenario                                             | Expected                                                  |
| --- | ---------------------------------------------------- | --------------------------------------------------------- |
| F01 | Spec worktree integrated, clean, no active execution | Eligible for explicit cleanup                             |
| F02 | Dirty/unpushed/ambiguous operation                   | Cleanup blocked                                           |
| F03 | Unmanaged/user-owned worktree                        | Never auto-deleted                                        |
| F04 | Main branch checked out in primary                   | Finalize does not checkout same branch in linked worktree |
| F05 | Only archived spec copy remains in linked worktree   | Cleanup refused until destination integration proven      |

## Deferred multi-instance user-defined step matrix (future follow-up only)

These **MI** IDs do not alter Foundation A/B or current managed Session acceptance. The Engine does not know a special `review` step: each scenario uses step-defined instructions, effects, typed result schema and aggregation policy. Prove offline Engine aggregation **before** managed provider scheduling; use real independent CLI processes and Git worktrees where applicable.

| ID   | Scenario                                                           | Required evidence                                                                                                     |
| ---- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| MI01 | Single-instance step with current CLI start/finish                 | Legacy behavior retained for a user-defined step, no additional workflow transition                                   |
| MI02 | User-defined N=3, sequential vs concurrent runs                    | Same typed output/declared reducer; one canonical attempt; maxConcurrency only affects scheduling                     |
| MI03 | Racing starts/finishes for one instance                            | Exactly one accepted slot/run and trusted identity; no duplicate contribution                                         |
| MI04 | Provider timeout/quota with 2/3 valid results                      | Keep contributions; independent bounded retry; incomplete if configured minimum not met                               |
| MI05 | Superseded run sends late result                                   | Fence and reject or idempotently recover accepted same-run result                                                     |
| MI06 | Crash after durable contribution before response                   | Idempotent replay; no duplicate count, action or transition                                                           |
| MI07 | Effect-based admission with readers and potential writers          | Readers may coexist only when enforced; writer/side-effectful step isolated or serialized                             |
| MI08 | Step activation changes metadata; dirty Git material changes later | Snapshot captured after activation; same-input policy detects different staged/unstaged/untracked content             |
| MI09 | Two user-defined step output schemas and reducers                  | All/any boolean and explicitly ordered/nominal enum policies resolve exactly as declared; no built-in review severity |
| MI10 | Partial results and configured exception/waiver                    | Audited actor and effective policy; no fabricated missing result or implicit human approval                           |
| MI11 | Two aggregate finalizers, crashing gate/commit transition          | One durable finalization and canonical state change; verify side effects exactly once                                 |
| MI12 | Input independence, provider provenance, rebind and offline CLI    | Declared semantic independence assessed honestly; stale source and unknown effects safe; Engine works without Runtime |

## Plan 02 lifecycle extension: LC01–LC40 (independent mandatory gate)

An LC PASS requires actual Engine/CLI/Runtime behavior on the implementation HEAD, NOT the presence of these tasks. "Both" means Windows and POSIX real Git/FS/OS-process runs. "One" means at least one platform plus cross-platform build/schema checks. Cases marked "Both" may be grouped into a platform matrix but no required case may be skipped.

| ID   | Platform | Required real scenario and non-success constraint                                                                                                                                                                                                                                                                                                                                             |
| ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC01 | Both     | Worktree close integrates committed source and leaves original specId active in primary; managed worktree removed only after binding CAS                                                                                                                                                                                                                                                      |
| LC02 | Both     | Follow worktree close with ordinary Specification close directly on primary; no second merge/worktree                                                                                                                                                                                                                                                                                         |
| LC03 | Both     | Direct linked Specification close archives in source, commits, integrates into primary and removes managed worktree                                                                                                                                                                                                                                                                           |
| LC04 | Both     | Direct primary Specification close archives and creates narrow Engine commit without integration/removal                                                                                                                                                                                                                                                                                      |
| LC05 | Both     | No duplicate canonical specId across active/archive or stale primary fallback; correct registry generation                                                                                                                                                                                                                                                                                    |
| LC06 | One      | Warm Runtime Overview cache, close via separate CLI, observe canonical refreshed active/archive result without restart                                                                                                                                                                                                                                                                        |
| LC07 | Both     | Fast-forward source branch integration, verify actual destination HEAD/files/all intended source commits; primary BRANCH unchanged                                                                                                                                                                                                                                                            |
| LC08 | Both     | Explicit already-integrated source ancestor accepted only if physical destination content is correct; never rerun merge                                                                                                                                                                                                                                                                       |
| LC09 | Both     | Divergence with conflict pauses with exact conflict evidence; primary remains clean and binding/source intact, no forced merge/reset                                                                                                                                                                                                                                                          |
| LC10 | Both     | Destination checkout on unexpected branch or HEAD changes during preview fails without checkout/silent replan                                                                                                                                                                                                                                                                                 |
| LC11 | Both     | Dirty, staged and untracked source files are individually rejected, including uncommitted create scaffold                                                                                                                                                                                                                                                                                     |
| LC12 | Both     | Dirty, staged and untracked primary each block integration or scoped archive commit                                                                                                                                                                                                                                                                                                           |
| LC13 | Both     | Unmanaged/foreign linked worktree is NOT removed; primary cannot be closed as worktree                                                                                                                                                                                                                                                                                                        |
| LC14 | Both     | Second CANONICAL bound Spec in linked workspace blocks removal; inherited untouched primary manifests do NOT count as occupants                                                                                                                                                                                                                                                               |
| LC15 | Both     | Missing, invalid, symlinked or duplicated manifest/source/target blocks with zero false success                                                                                                                                                                                                                                                                                               |
| LC16 | Both     | Missing/moved/replaced linked instanceId, wrong common-dir/path/branch blocks cleanup and rebind                                                                                                                                                                                                                                                                                              |
| LC17 | Both     | OS processes race using distinct Spec IDs on the SAME primary index/target ref; Create vs Close after initial journal inspection; acquire shared durable resource claims so conflicts serialize without overlapping Git effects. Also same-spec different-ID exclusion; disjoint linked creates remain safe                                                                                   |
| LC18 | Both     | Identical operationId and intent retry returns same evidence/result, changed intent conflicts                                                                                                                                                                                                                                                                                                 |
| LC19 | Both     | OS-process SIGKILL before/during/after archive move leaves inspectable intent; safe replay or explicit recovery                                                                                                                                                                                                                                                                               |
| LC20 | Both     | OS-process SIGKILL after archive commit before integration detects committed tree, no duplicate archive commit                                                                                                                                                                                                                                                                                |
| LC21 | Both     | OS-process SIGKILL DURING primary merge publication after ref/HEAD movement but before index/working-tree convergence, or after full integration before CAS: verify destination HEAD + index tree + physical files (ancestry alone insufficient), then rebind exactly once only after full proof                                                                                              |
| LC22 | Both     | OS-process SIGKILL after CAS before worktree deletion and after deletion before retirement: primary remains canonical, no wrong-path deletion                                                                                                                                                                                                                                                 |
| LC23 | Both     | Killed/unknown REAL Git subprocess or Engine lifecycle journal/lock outcome never auto-replayed from PID/timeout; inspect actual durable evidence, no fabricated external-writer service                                                                                                                                                                                                      |
| LC24 | One      | Ordinary authorized Spec close succeeds using REAL current preflight; public request/result/journal has NO fake gateDisposition, exitEvaluation, admin-bypass acknowledgement, process list or quiescence flag; future workflow/disposal TODO checkpoints visibly placed                                                                                                                      |
| LC25 | One      | Unauthenticated or per-Spec close-only HTTP caller cannot integrate entire branch: project-wide Git integrate permission required BEFORE any integrate=true archive commit; archive-only close works without it; protected auth/config change denied without explicit grant                                                                                                                   |
| LC26 | Both     | Real Git paths with spaces and non-ASCII; Windows casing, Unicode, literal pathspecs and worktree cleanup safe                                                                                                                                                                                                                                                                                |
| LC27 | Both     | Already archived repeated close is evidence-backed idempotent or explicitly conflicted; never creates another commit                                                                                                                                                                                                                                                                          |
| LC28 | One      | CLI offline and HTTP authenticated both invoke same Engine use cases, same operation ID/error semantics and correct read freshness                                                                                                                                                                                                                                                            |
| LC29 | Both     | Ignored per-checkout local files (.nevo/local config, logs, history, artifacts) block managed worktree removal; only pinned Engine identity marker is eligible                                                                                                                                                                                                                                |
| LC30 | Both     | Current single-format Create journal preserves immutable scaffold SHA-256, identity and explicit operator recovery across SIGKILL; deprecated v1 and old manifest paths are rejected without side effects                                                                                                                                                                                     |
| LC31 | Both     | Source branch commits touching OTHER Specification files cannot silently integrate/close an exclusive managed worktree                                                                                                                                                                                                                                                                        |
| LC32 | Both     | Linked close-spec pins preArchiveSourceHead and a DISTINCT verified archive integrationSourceCommit; destination contains actual archive commit                                                                                                                                                                                                                                               |
| LC33 | Both     | Killed process after journal-owned archive staging: replay recognizes only exact scoped staged state and rejects alien index additions                                                                                                                                                                                                                                                        |
| LC34 | One      | New scaffold has no workflow-mode selector and uses only specification.yaml; no alternate algorithm or fallback mode is inferred                                                                                                                                                                                                                                                              |
| LC35 | Both     | Canonical specification.yaml resolves; deprecated change.yaml-only, both filenames, symlink and incorrect casing fail closed with no content mutation                                                                                                                                                                                                                                         |
| LC36 | Both     | Single current Create journal rejects prototype version 1, obsolete path and tampered hash/identity; retry, idempotency, CAS and OS-process crash recovery still pass                                                                                                                                                                                                                         |
| LC37 | Both     | T10 parser supports git.integrationTargetBranch alongside git.enabled semantics; missing runtime-only old project config requires explicit migration, T16 init selection; wrong checked-out primary branch blocks even direct primary archive                                                                                                                                                 |
| LC38 | Both     | Linked close-spec integrateToTargetBranch=false archives+commits LOCALLY, retains bound archived Spec and worktree, no primary change; later worktree-close integrates archive and guarded cleanup                                                                                                                                                                                            |
| LC39 | Both     | Two different linked Specs concurrently integrating into one configured target ref; exclusive durable ref+checkout claim. Diverged disjoint branches clean merge in isolated verified checkout; publish candidate to primary with checked-out fast-forward updating HEAD/index/files (NOT update-ref only). SIGKILL before/during publication must not produce false success/duplicate commit |
| LC40 | Both     | Post-archive Git conflict leaves primary untouched, source archived canonically in linked checkout; result truthful retained/needs-resolution, scratch/journal safe and later CloseWorktree viable after external reconciliation, no fake agent action                                                                                                                                        |

Mandatory scope: LC01–LC40. LC24 proves ABSENCE of speculative gate/writer contracts, and LC03/LC04/LC20/LC32/LC38 prove automatic Engine archive commit. All cases marked Both require real Git and filesystem on Windows and POSIX, including actual OS-process termination for LC19–LC23, LC33 and LC39. POSIX uses SIGKILL and Windows uses proven forcible OS-process termination with equivalent crash-checkpoint evidence. Live-process uncertainty must not be simulated solely with thrown exceptions. Test fixtures must record raw commit/ref, index/untracked state, identities, operation checkpoint, per-platform Git/Node/OS version and negative side-effect assertions. PR CI and independent reviewer sign-off are required. Deferred to Plan 03/04/05: actual external writer claims, provider/native Session resume safety, real spec-level workflow gates/actions, per-task attempts, human-verification provenance, remote PR integration, multi-instance execution.

## Running and reporting

No concrete command names are prescribed until tests exist. Proposed categories: `engine:unit`, `engine:git-integration`, `engine:process-integration`, `runtime:integration` or equivalent using Turborepo/package scripts. CI should keep required checks stable and run affected packages. Mark tests explicitly skipped when Git executable/platform is unavailable rather than passing a fake.

Test reports should include OS, Git/Node versions, revision under test, per-ID PASS/FAIL/SKIP, reason for every skip and physical fixture cleanup result. Do not claim acceptance if required L/R/H tests are skipped.

## Exit criteria per stage

- **Foundation A:** C01–C12, L01–L02/L07, R01–R05, H01–H06/H08/H10, P01–P06 and SC00 all pass on the supported platforms; if a scenario is explicitly excluded from supported topology, owner records the exception and the related no-go limitation. **Do not require** L03–L06, H07, R06/R07 or full Workflow here.
- **Foundation B:** L03–L06, W01–W10, H07, SC01–SC02 and AG01–AG03 pass (or owner explicitly approves a documented cooperative-only trust model where strong actor separation is not technically enforced). Demonstrate a **real minimal deterministic step**, not a stub coordinator API. H07 tests an external CLI workflow through Runtime read projections, not provider execution. No AI provider required.
- **Sessions / Managed integration:** S01–S08, H09 and R06 pass with mock provider and actual Engine coordinator from B. **Later binding/finalization** owns B01–B04 and F01–F05; **later full deterministic workflow migration** owns R07. Their contracts must still be reviewed before the relevant API is frozen.

A skipped critical required test is **not** success. Report actual PASS/FAIL/SKIP, per-stage counts, OS/Node/Git versions, fault injection checkpoints, artifact links and justified deferrals. See [staged acceptance](acceptance-criteria.md).
