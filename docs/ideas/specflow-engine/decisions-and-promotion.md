---
id: ideas.specflow-engine.decisions
type: architecture
title: Open decisions tradeoffs and promotion plan
status: draft
scope: specflow
areas: [docs, workflow, runtime, cli, configuration]
tags: [decision-record, alternatives, adr, migration]
read_when:
  - agreeing which engine/worktree concepts should be adopted
  - preparing ADRs and freezing the architecture after tests
summary: >
  Non-authoritative decision backlog, tradeoffs, owners and explicit evidence required
  before promoting offline Engine/worktree proposals into normative architecture documents.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.boundaries
  - ideas.specflow-engine.ownership
  - ideas.specflow-engine.test-plan
  - ideas.specflow-engine.acceptance
  - ideas.specflow-engine.managed-session-integration
  - ideas.specflow-engine.project-home
  - ideas.specflow-engine.local-actors
---

# Decisions, alternatives and documentation freeze

## Explicit assumptions already expressed by the owner

- Users may start agents outside the SpecFlow Runtime; such agents can work using skills and CLI; their native Sessions need not appear in Runtime.
- Deterministic workflow should function without a running Runtime, with cross-process file-based coordination if proven safe.
- A new Specification may optionally be placed into its own Git worktree, when Git integration is enabled.
- One project should list Specs from the primary checkout and explicitly locally registered linked worktrees, without treating all Git worktrees as product-owned.
- Build/test a narrow real vertical slice first, then freeze tested architecture and write instructions for subsequent legacy Nevo migration.
- Use `main` as source base; PR #45 is **preview of direction** and must not be assumed merged.
- Keep concepts in `docs/ideas/**` until evaluated; many targeted documents are preferable to one monolith.

These are intent/constraints, not approvals of every candidate code shape in this dossier.

## Open decision register

| ID  | Question / alternatives                                                                                              | Proposed experiment or evidence                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | New private `@nevo/specflow-engine` package or Runtime sub-entrypoint?                                               | Verify import graph, independent CLI smoke and one bundled artifact; favour package only if separation wins                                  |
| D02 | Where and how to locate the single project state home from a linked checkout?                                        | Primary checkout enumeration, verified Git common-dir, explicit fallback locator, moved-home tests                                           |
| D03 | Is a Git-backed project with disabled Git actions supported while completely non-Git project support stays deferred? | Test disabled capability inside existing Git-backed init without changing unrelated boot contract                                            |
| D04 | Managed worktree naming/root/branch default and override policy?                                                     | Windows paths, collisions, existing branch, worktree already checked out                                                                     |
| D05 | Permit imported unmanaged worktrees and multiple specs in one linked tree?                                           | Start managed one-spec model; define explicit future attach semantics                                                                        |
| D06 | What exactly is stored in registry/journal versus committed manifest?                                                | Restore after crash; verify no conflicting canonical status                                                                                  |
| D07 | External execution claim identity, proof, renewal and release when CLI ends?                                         | Two-process conflict, invisible provider, no heartbeat, dead PID, unknown claim                                                              |
| D08 | How does offline CLI actor attribution/authorization relate to Runtime HTTP Auth?                                    | Document local trust boundary; reject untrusted owner/session handles                                                                        |
| D09 | Which operation stages require durable intent, how long retain evidence?                                             | Failure injection at each stage, repeat same operation ID                                                                                    |
| D10 | Which Runtime read repositories consume Engine directly versus composition read projections?                         | Compare main and #45 preview endpoints, no fixture production fallback                                                                       |
| D11 | Which interface surfaces show unavailable worktree/blocked external execution?                                       | Read-model semantic tests before UI design                                                                                                   |
| D12 | Cleanup/archival and Git PR merge policy after initial PoC?                                                          | Explicit later slice, do not hardcode old single-checkout finalize                                                                           |
| D13 | Whether to auto-commit created scaffold or leave uncommitted?                                                        | Check UX, dirty-gate implications and crash/idempotency                                                                                      |
| D14 | Is local filesystem-only coordination a documented constraint or do we need shared/network support?                  | Initial support only local supported filesystems; defer network/multi-host                                                                   |
| D15 | Where to run two-level lock coordination and what order?                                                             | Cross-process deadlock and crash scenarios                                                                                                   |
| D16 | Config namespace, default Git enablement and capability discovery API?                                               | Product config provenance / local override policy review                                                                                     |
| D17 | What proves Project Home after moved/deleted primary checkout or multiple config copies?                             | Exercise explicit verified locator, ambiguous/missing-home and repair cases in Foundation A                                                  |
| D18 | How is canonical binding relocated/rebound after merge?                                                              | Verify destination manifest/content and CAS binding revision before cleanup; B01–B04                                                         |
| D19 | What is the stable product Session ID and new Turn workspace resolution policy?                                      | Contract + S01/S07, reconcile current provisional ProviderSessionRef architecture                                                            |
| D20 | Does read-only provider transport actually prevent writes?                                                           | Derive effect scope from enforced capabilities, not 'readOnly' request flag                                                                  |
| D21 | How are human approvals trusted if agent has local CLI/file access?                                                  | Distinguish cooperative OS account model versus authenticated human channel; AG01–AG03                                                       |
| D22 | What is the exact managed dispatch intent/unknown-outcome protocol?                                                  | Persist correlatable claim and invocation milestones; S02/S06                                                                                |
| D23 | How is Engine-produced dirty scaffold admitted to authoring without global gate bypass?                              | SC00–SC02, owner decision on auto-commit versus declared baseline                                                                            |
| D24 | Which committed configuration is operational policy and which workflow revision is executed?                         | Project Home policy P06 (Foundation A); workspace-bound immutable attempt definition W10 (Foundation B), decide uncommitted snapshot support |
| D25 | Which Authorization scope dimensions are portable across clones and which are local only?                            | Reject unsupported versioned workspaceId grants; validate canonical specId/project-level assignment via H10                                  |
| D26 | How is Runtime read cache refreshed after an offline CLI mutation while the server stays up?                         | Required H03/FA02: cached read -> CLI mutation -> supported refresh/re-read; no SSE mandate                                                  |
| D27 | Must Foundation A repair physically moved Project Home or only detect it safely?                                     | A must detect and not initialize new state (P02); defer successful home relocation/repair to a separately approved lifecycle gate            |
| D28 | Does the agent use contextual `step finish` or an explicit instance-result command?                                  | Prove backward-compatible single-instance skills and distinct contribution/step-finalization responses                                       |
| D29 | How does the user define N, quorum, concurrency and typed completion/resolution policies?                            | Pin validated policy and step instructions; test two different user-defined steps, N=1 and N=3                                               |
| D30 | How are stable instance IDs, runs, Sessions, Turns and provider invocations correlated?                              | Race, crash, late submission and secure token/fencing evidence                                                                               |
| D31 | What baseline is required for steps whose inputs must match?                                                         | Pin post-activation material; test Git dirty/index/untracked state, rebind and external writers                                              |
| D32 | Which effect scopes allow multiple instances on one workspace?                                                       | Read-only enforcement, writer serialization/isolation, Git/ref/external side effects and verification gates                                  |
| D33 | What typed reductions and result-to-transition mappings can user definitions declare?                                | Bool all/any, ordered and nominal enums, lists and unresolved-result fail-closed behavior                                                    |
| D34 | What retry, reassignment, incomplete and policy-waiver operations are valid?                                         | Bounded independent retries, uncertain effectful dispatch and auditable authorized exceptions                                                |
| D35 | Where is offline contribution state and how does aggregate finish stay idempotent?                                   | Separate durable Engine submissions/finalize, two finalizers and crash-stage tests                                                           |
| D36 | What does requested instance independence mean vs observed model/provenance?                                         | Record declared model/history/prompt exposure constraints; never infer semantic diversity from distinct Session IDs                          |
| D37 | When are step instructions, inputs and effectful inspect/verify/finalize gates pinned and run?                       | Activation-before-snapshot test, gates with generated files, supported execution modes and contract revision                                 |

**Do not silently decide D02, D07, D08, D09, D17, D21, D24 or D25 while implementing a happy-path create endpoint.** They determine actual correctness. The PoC may narrow its supported cases explicitly while demonstrating chosen behavior.

## Alternatives and why they are not the first approach

- **All workflow through Runtime HTTP:** simplest single owner process, but breaks unattended CLI/skills when server off.
- **Runtime launches CLI subprocess for each command:** reuses code superficially; leaks CLI output, process invocation and lifecycle into server semantics; creates duplicated error and cancellation paths.
- **Every agent must register a Runtime Session:** not possible for arbitrary externally launched agent without losing offline independence.
- **Short lock only:** insufficient while an external agent edits after CLI exits.
- **Database daemon for lock registry:** could simplify transactional state but introduces a process/runtime dependency; not justified before testing filesystem coordination.
- **Worktree mandatory:** changes current simple workflow and multiplies storage/infrastructure; user wants optional.
- **One Runtime per worktree:** duplicates managed sessions/ports and complicates unified Overview.
- **Everything in a single YAML config:** confuses human policy with machine-managed journal/registry, complicates safe mutation.
- **Mirror every spec manifest into central state:** creates competing sources of truth with divergent branches.
- **Package per small concern:** unnecessary boundaries; verify one Engine source boundary before splitting further.

## Staged release and independent evidence

- **Foundation A:** prove Project Home/config/registry, real Specs create, optional worktree, HTTP/CLI parity, journal and process-safe create/registry locks. No fake workflow admission endpoint.
- **Foundation B:** prove one real deterministic start/finish, non-Task authoring writer, read-only execution, explicit claim inspect/reconcile/release and safe escalation. External CLI remains usable without Runtime.
- **Sessions Foundation:** stable Session/Turn/Work persistence, HTTP and mock provider; works ad hoc without workflow.
- **Managed Integration:** Runtime Turn coordinator calls Engine admission with resolved current workspace and persists invocation intent; staged crash/unknown-outcome and Task batch/handover tests.
- **Legacy migration:** provider adapters and remaining deterministic workflow steps, reviews and Git actions can evolve in parallel after handshake approval; finalization/rebind/cleanup remains separate.

See [managed Sessions](managed-session-integration.md), [recovery scopes](execution-scopes-and-recovery.md), [binding lifecycle](workspace-binding-lifecycle.md) and [human gates](local-actor-and-human-gates.md).

## Implementation-to-decision pipeline

1. Start from freshest main; read accepted docs and PR #45 as **unmerged reference**.
2. Write implementation-specific mini-spec for `create Specification` + optional worktree, referencing this dossier.
3. Build offline Engine + CLI + real Git fixture tests; only enough Runtime HTTP to exercise same operation.
4. Exercise concurrency, missing worktree, restart and crash stage tests. Record open decisions and failures.
5. Conduct independent architecture/code review. Compare actual dependency graph to acceptance criteria.
6. Make explicit owner decisions for open tradeoffs. Record accepted facts with test/PR/commit evidence.
7. Create/modify normative architecture/engineering docs and ADRs in their actual homes (not `ideas`). Consider a new ADR for offline Engine ownership, and update ADR 0012, runtime ownership, configuration and deterministic workflow docs as needed.
8. Create the detailed legacy migration instruction/matrix against newly accepted contracts; mark/supersede this idea when appropriate. Later implementation agents should not mistake draft proposals for instructions.

## What an ADR should freeze

- Offline Engine callable from CLI and Runtime, authority for Specs/Workflow operations, permitted dependency directions.
- Ownership of local state, short locks, long claims and process-neutral recovery.
- Stable Project/Workspace/Spec identity and source-binding precedence.
- Optional Git capability, worktree lifecycle and hard safety boundaries.
- Runtime ownership restricted to actually managed live provider resources, Sessions and HTTP transport.
- Explicit supported OS/filesystem assumptions and what remains deferred.
- Constraints on future migrations: no CLI-handler imports in Runtime, no provider/session dependency in workflow, no implicit one-checkout roots.

## What must not be frozen prematurely

Exact public command names, JSON schema fields, package name, Git error code strings, token/heartbeat implementation, cleanup policy, initial UI widget shape or cross-platform filesystem guarantees without tests and owner approval. Distinguish design intent from an implemented production contract.
