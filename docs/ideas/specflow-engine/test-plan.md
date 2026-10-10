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

For each case capture: setup, command/API, machine-readable result, files/refs/registry state, side-effect count, and cleanup verification. Failure tests must establish *absence* of unintended effects.

## Layers and explicit gates

**Foundation A** owns C01–C12, L01/L02/L07 (registry/control locks only), R01–R05, H01–H06/H08, P01–P05 and SC00 (known scaffold classification only). **Foundation B** owns L03–L06, W01–W09 and SC01–SC02; it needs a real minimal workflow step, not a fake acceptance endpoint. **Sessions integration** owns R06/R07, H07/H09 and S01–S08 plus rebind-specific tests B01–B04; they are not Foundation A preconditions. OS/platform evidence applies to all stages when implemented.

1. **Pure/domain:** validation, id/slug collision rules, read projections, location binding precedence, error taxonomy, transition/idempotency planning.
2. **Filesystem+Git integration:** real `git init`, initial commit, `git worktree add/list/remove`, inspect membership, branch and dirty state.
3. **Separate-process coordination:** spawn independent Node/CLI processes with barrier synchronization, kill one at injected stage.
4. **Runtime HTTP integration:** authenticate/authorize, invoke real feature endpoint and Engine-backed repository; check readable data without frontend fixtures.
5. **Optional UI smoke:** feature API + create form, title-only, capability-conditioned worktree switch, refresh of Overview/Workspace.

## Creation and discovery matrix

| ID | Scenario | Expected |
| --- | --- | --- |
| C01 | CLI create in primary with Runtime off | One valid manifest; returned specId resolves |
| C02 | CLI create new worktree with Git enabled | Exactly one branch, linked worktree, registry binding, valid manifest |
| C03 | Git integration disabled + `new-worktree` | Structured capability failure; no branch, path or registry write |
| C04 | Only title given | Generated slug and identity, valid default scaffold |
| C05 | Repeat same operation ID | Exact same resource/result; no duplicate |
| C06 | Two specs in separate worktrees | Distinct roots; isolated uncommitted edits |
| C07 | Same specId manifest in main and bound worktree | One visible spec; bound worktree wins |
| C08 | Bound worktree removed out-of-band | Explicit unavailable/repair state; no silent primary fallback |
| C09 | Duplicate/conflicting binding or corrupt registry | Fail closed; no overwrite |
| C10 | CLI invoked from linked worktree | Resolves same project home and local registry |
| C11 | Another clone shares remote URL | Not implicitly adopted into same local project |
| C12 | Space/non-ASCII paths, branch exists, symlink substitution | Correct handling/explicit conflict; no wrong directory mutation |

## Project Home and binding provenance (Foundation A)

| ID | Scenario | Expected |
| --- | --- | --- |
| P01 | CLI from primary and registered linked checkout | Same projectId, registry/state/config owner, distinct workspace IDs |
| P02 | Two home markers or home missing | Explicit ambiguity/unavailable, no empty-project reinitialization |
| P03 | Explicit home locator points to unrelated Git common-dir | Rejected even with supplied absolute path |
| P04 | Independent clone with same remote URL | Separate local state, no shared claim/registry |
| P05 | Bound worktree unavailable but same-id manifest in primary | Unavailable source, no stale fallback |

## Initial creation baseline

| ID | Stage | Scenario | Expected |
| --- | --- | --- | --- |
| SC00 | A | Create scaffold, persist provenance | Machine-readable known files/fingerprint; unknown dirty state not automatically trusted |
| SC01 | B | Start spec authoring immediately after create | Known Engine scaffold can be admitted for writing under action policy |
| SC02 | B | Unrelated dirty edits or clean-tree gate | Correct explicit blocker/remediation; no global dirty bypass |

## Concurrency and crash matrix

| ID | Scenario | Expected |
| --- | --- | --- |
| L01 | Two OS processes create same slug/branch simultaneously | One success and one explicit conflict; unique registry |
| L02 | Concurrent creates with distinct specs | Both persist; no lost JSON update |
| L03 | CLI finishes `start`, agent simulated still writing, Runtime tries same workspace | Claim blocks conflicting Engine writer after CLI exits |
| L04 | Separate worktrees concurrently claimed | Independent work can proceed |
| L05 | Wrong owner token/identity attempts finish/release | Refused; claim unchanged |
| L06 | Stale claim with unknown external agent outcome | Recovery-required; no auto-steal |
| L07 | Corrupt lock file | Fail closed and provide diagnostic |
| R01 | Kill after intent/reservation | Retry recovers or unwinds without duplicate |
| R02 | Kill after Git worktree create | Retry verifies and resumes; no second worktree |
| R03 | Kill after manifest before registry | Verified re-link to original spec ID |
| R04 | Kill after registry before response | Same result returned on retry |
| R05 | External file changes during recovery | Explicit conflict; no delete/overwrite |
| R06 | Runtime shutdown during managed operation | Own resource settles; external claims not confiscated |
| R07 | Process restarts with an interrupted workflow finish (later migration) | No duplicated stage or attempt |

## Minimal real workflow and claim recovery (Foundation B)

| ID | Scenario | Expected |
| --- | --- | --- |
| W01 | Separate CLI starts actual simple deterministic workflow with Runtime stopped | Real attempt identity, not mock or Session |
| W02 | Separate CLI finishes same step | Explicit transition/evidence, no implicit next start |
| W03 | Spec Writer scope with no taskId | Workspace writer claim allowed when effects require it |
| W04 | Enforced read-only analysis | No writer claim; if write restriction unproven, fail conservative |
| W05 | Claim survives command termination | Other competing writer blocked, different worktree may proceed |
| W06 | Terminal Turn/release evidence (without provider) | Release does not finish active workflow attempt |
| W07 | Proven terminal external execution, valid journal | Inspect then safe reconcile + CAS release; workspace unblocked |
| W08 | Abandoned/unknown external writer | Actionable inspection, safe owner release or explicit escalation; no TTL/PID theft |
| W09 | Wrong owner/role or agent-supplied human review | No forged human approval, even when valid claim exists |

## Operator identity and human approval policy

| ID | Scenario | Expected |
| --- | --- | --- |
| AG01 | Agent uses CLI human confirmation without independent trusted actor | No privileged approval under secure policy |
| AG02 | Human gate evidence from previous attempt or another task/gate | Rejected; no evidence bleed |
| AG03 | Shared OS-account agent with full file access | Threat model explicitly states advisory—not adversarial—security; no false guarantee |

## HTTP/observability and security

| ID | Scenario | Expected |
| --- | --- | --- |
| H01 | Offline CLI create then start Runtime and GET Overview/Workspace | Same canonical spec, correct root |
| H02 | HTTP create then stop Runtime and invoke CLI | Same manifest and registry visible |
| H03 | CLI modifies spec while Runtime runs | Backend refresh/invalidation exposes change without restart |
| H04 | Missing production source | Honest 503/unavailable, never demo fallback |
| H05 | Demo mode | No writes to production Git/registry |
| H06 | Unauthorized create/worktree request | 401/403 as relevant, zero side effects |
| H07 | External agent progresses Engine workflow | Workflow state visible, no fabricated managed Session |
| H08 | Invalid file/document ID or target path escapes workspace | Rejected without path disclosure/read/write |
| H09 | Scope-limited user accesses Session references in spec projection | Unauthorized Session data redacted/forbidden |

## Managed Sessions integration (later gate, mock provider)

| ID | Scenario | Expected |
| --- | --- | --- |
| S01 | Standalone managed Session/Turn without Task workflow | Stable product sessionId, read-only mode needs no writer, history reload-equivalent |
| S02 | Managed writable Turn performing one Engine Task step | Current resolved cwd, writer claim + persisted invocation intent, deterministic release |
| S03 | Turn settles terminal before explicit workflow finish | Task stays unfinished, no automatic reviewer Session |
| S04 | One Session performs explicit Task batch sequentially | Per-Task attempt identity and current execution scope, no historical binding ambiguity |
| S05 | Handover creates successor Session | Explicit lineage/context; no silent claim transfer/step advance |
| S06 | Crash at prepared, dispatching, spawned-but-not-correlated, started | No duplicate dispatch under uncertain outcome; positive evidence for safe replay only |
| S07 | Workspace root moved/rebound/missing then new Turn resumes | Revalidate binding/current cwd/native compatibility; preserve readable history |
| S08 | Limited HTTP actor reads Session/Task/Specs projections | Scoped redaction/403/404 without cross-resource leakage |

## Binding change and cleanup (later gate)

| ID | Scenario | Expected |
| --- | --- | --- |
| B01 | Merge content into destination, rebind canonical source | Destination verified, CAS binding generation, one canonical spec |
| B02 | Merge claimed but destination files stale | Explicit rebind conflict, no cleanup |
| B03 | Active Turn or unresolved writer during rebind | Operation blocked/reconciled; history unaffected |
| B04 | Worktree manually removed/moved then reattach | Verify Git membership and identity; no guessed main fallback |

## Finalization/cleanup probes (later slice, design must accommodate)

| ID | Scenario | Expected |
| --- | --- | --- |
| F01 | Spec worktree integrated, clean, no active execution | Eligible for explicit cleanup |
| F02 | Dirty/unpushed/ambiguous operation | Cleanup blocked |
| F03 | Unmanaged/user-owned worktree | Never auto-deleted |
| F04 | Main branch checked out in primary | Finalize does not checkout same branch in linked worktree |
| F05 | Only archived spec copy remains in linked worktree | Cleanup refused until destination integration proven |

## Running and reporting

No concrete command names are prescribed until tests exist. Proposed categories: `engine:unit`, `engine:git-integration`, `engine:process-integration`, `runtime:integration` or equivalent using Turborepo/package scripts. CI should keep required checks stable and run affected packages. Mark tests explicitly skipped when Git executable/platform is unavailable rather than passing a fake.

Test reports should include OS, Git/Node versions, revision under test, per-ID PASS/FAIL/SKIP, reason for every skip and physical fixture cleanup result. Do not claim acceptance if required L/R/H tests are skipped.

## Exit criteria per stage

- **Foundation A:** C01–C12, L01–L02/L07, R01–R05, H01–H06/H08, P01–P05 and SC00 all pass on the supported platforms; if a scenario is explicitly excluded from supported topology, owner records the exception and the related no-go limitation. **Do not require** L03–L06, H07, R06/R07 or full Workflow here.
- **Foundation B:** L03–L06, W01–W09, SC01–SC02 and AG01–AG03 pass (or owner explicitly approves a documented cooperative-only trust model where strong actor separation is not technically enforced). Demonstrate a **real minimal deterministic step**, not a stub coordinator API. No AI provider required.
- **Sessions / Managed integration:** S01–S08, H07/H09 and R06/R07 pass with mock provider and actual Engine coordinator from B. B01–B04 and F01–F05 are later binding/finalization gates, but their contracts must be reviewed before API freeze.

A skipped critical required test is **not** success. Report actual PASS/FAIL/SKIP, per-stage counts, OS/Node/Git versions, fault injection checkpoints, artifact links and justified deferrals. See [staged acceptance](acceptance-criteria.md).
