---
id: ideas.specflow-engine.ownership
type: architecture
title: Execution ownership and state authority
status: draft
scope: specflow
areas: [workflow, runtime, configuration, security]
tags: [ownership, authority, persistence, session]
read_when:
  - deciding which process owns workflow versus AI execution state
  - designing persistence and lifecycle across CLI and Runtime
summary: >
  Candidate authority split between committed specification facts, Engine execution state,
  transient workspace claims, and Runtime-owned live Session/Turn resources.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.boundaries
  - ideas.specflow-engine.offline-agents
  - ideas.specflow-engine.locking
  - architecture.ai.canonical-session-turn-work
---

# Ownership and state authority

## The decisive distinction

**Workflow ownership is not AI Session ownership.** External agents can invoke the local CLI with no Runtime, progress deterministic workflow, and write repository facts. Their native conversation is not managed by SpecFlow Runtime, not replayable from Runtime and need not appear in Sessions UI. Runtime can show accurate Specification/Task/Workspace status from Engine-owned state without inventing a managed Session.

A process being alive does not automatically make its state canonical. Conversely, a durable workflow attempt is not a long-lived process. Do not bind claims to task lifetime merely because task progress persists.

## Proposed authority table

| Information | Authority / owner | Persistence | Visibility |
| --- | --- | --- | --- |
| `specId`, title, documents, task definitions | Specs Engine + versioned repository files | Git-tracked YAML/Markdown | CLI and Runtime reads |
| Workflow step/attempt, approvals, transitions | Workflow Engine | Authoritative manifest/accepted workflow records | CLI and Runtime reads |
| Multi-stage operation journal/recovery evidence | Engine operation service | Ignored local durable storage | CLI and Runtime diagnostics |
| `specId -> workspaceId` | Project Workspace Registry | Ignored local registry | CLI and Runtime |
| Short transaction lock, longer execution claim | Engine coordination subsystem | Cross-process lock/claim files | CLI and Runtime |
| Provider-native external chat | External provider/tool | Provider-owned, if at all | **Not** Runtime Session |
| Runtime-managed canonical Session/Turn/Work | Runtime Sessions capability | Runtime-owned durable store | Runtime UI/API |
| Provider process, stream, prompts, interactions | Running Runtime | Live resources + recovery metadata | Runtime only |
| HTTP identity and scoped authorization | Runtime Auth | Config + request context | HTTP boundary only |
| UI Query cache/Attention presentation | UI and Runtime projection | Derived/refreshable | Browser |

**Source provenance is part of authority.** The Project Home's committed config plus ignored local config determines effective local operational/project policy; a linked checkout's alternate `.nevo/config.yaml` is not an implicit replacement. Versioned workflow definition content is selected from the actual execution workspace, and its exact revision is pinned to the Engine's workflow attempt. This is not a second mutable workflow-status store; see [Project Home provenance](project-home-discovery.md).

Avoid persisting derived readiness, computed lane, live-process guesses or the same canonical state in competing mutable stores. A runtime cache may subscribe to changes but is never the owner.

## Split local storage without splitting identity

Candidate directory arrangement, **not yet a contract**:

```text
.nevo/local/
  config.yaml                    # human/configuration ownership
  state/
    workspaces.json              # Engine registry
    engine/
      operations/                # Engine mutation journal
      claims/                    # Engine cross-process claims/locks
      evidence/                  # Engine workflow verification evidence
    runtime/
      sessions/                  # Runtime-managed Sessions and Turns
      transcripts/               # Runtime cache/provider diagnostics
```

A central state home makes multi-worktree discovery possible, but a physical workspace lock must be addressed identically from **every** process. Plan for atomic writes, corruption handling, format versions and controlled retention. JSON is a reasonable candidate for machine-owned state; YAML remains appropriate for human-authored config/manifests/frontmatter. Format consistency with frontmatter is not a reason to use YAML for every lock or journal.

## Live versus durable lifecycle

An externally launched agent may stay alive after CLI exits. Engine sees a claim and workflow evidence, not a guaranteed provider lifecycle. Runtime only owns and may cancel processes it actually launched. External agents may optionally publish explicit correlation later, but must not be force-attached as canonical Sessions.

The long-lived Execution Claim's release is independent of advancement/completion of a Workflow Attempt. Releasing after a settled live execution should not silently mark an incomplete task completed; an incomplete workflow can resume later.

## Security and actor attribution

An HTTP user must pass Auth/authorization before invoking Engine. Local CLI derives its actor/trust basis from the local execution environment or explicit trusted local mechanism; arbitrary agent-supplied strings do not convey authority. A capability/claim ID is not automatically an authentication credential. Design explicit ownership proof and file permissions if a token is used.

## Reconciliation requirements

- Engine recovery reconciles incomplete operations and claims when any process next accesses the workspace; no always-running daemon is assumed.
- Runtime startup may request Engine reconciliation but cannot override an unresolved external claim merely because it did not spawn the agent.
- Loss of provider process is not necessarily loss of a durable workflow attempt.
- Crash diagnostics must distinguish `blocked`, `recoverable`, `unknown/ambiguous`, `settled` without fabricating a live Session.
- State home and per-workspace partitioning are versioned; records referencing missing worktrees remain diagnosable.

## Existing contract tension

Current `docs/architecture/runtime/ownership-and-lifecycle.md` says Runtime owns local execution records; proposed split narrows that to Runtime's own live Sessions/Turns and associated recovery. `docs/architecture/workflow/deterministic-workflow.md` already requires transport-neutral application operations, but its trusted executor wording may need clarification for offline CLI. **Document the conflict, seek owner decision, then update normative text after PoC**.

## Approval provenance and ownership reconciliation

Do not equate the existence of a locally persisted `humanVerification` JSON record with an authenticated human decision. Human-gate evidence is per spec/task/step/attempt/gate and carries verifiable actor provenance under an adopted trust model. Under an unrestricted shared OS account, a CLI argument `--role owner` or workspace claim token is not strong proof of a human. Offline agents may request review but must not self-approve solely through their execution identity; see [local actors and human gates](local-actor-and-human-gates.md).

**Runtime Session state and Engine workflow state may refer to the same execution without either owning the other.** Runtime owns dispatch, interactions and provider liveness; Engine owns physical workspace admission and workflow attempt state. Their correlation requires an explicit [managed execution handshake](managed-session-integration.md) and evidence-based [claim recovery](execution-scopes-and-recovery.md). Keep runtime transcript history readable when a workspace is moved/unavailable.
