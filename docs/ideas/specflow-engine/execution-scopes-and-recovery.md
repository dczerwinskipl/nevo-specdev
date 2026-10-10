---
id: ideas.specflow-engine.execution-scopes
type: architecture
title: Execution scopes ownership and claim recovery
status: draft
scope: specflow
areas: [workflow, runtime, cli, ai, security]
tags: [execution-scope, ownership, claims, recovery]
read_when:
  - admitting external CLI or managed AI work without assuming a Task
  - recovering abandoned or uncertain writer claims
summary: >
  Distinguishes workflow attempt, Turn, execution effects and physical ownership; proposes
  evidence-driven inspect/reconcile/release flows that also work without a running Runtime.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.locking
  - ideas.specflow-engine.offline-agents
  - ideas.specflow-engine.managed-session-integration
  - ideas.specflow-engine.local-actors
  - architecture.workflow.deterministic-workflow
---

# Execution scopes and recovery

## Four orthogonal axes

1. **Business target:** ad-hoc conversation, specification authoring, a Task, or an explicit Task batch. An authoring operation may exist **before Task IDs exist**.
2. **Execution owner:** Runtime-managed Turn, external agent using skills+CLI, or trusted operator CLI action.
3. **Effect capability:** enforced read-only, workspace file writer, Git/ref mutator, or mixed. A declared intent is not proof that a provider cannot write.
4. **Deterministic workflow identity:** optional `(change, task, step, attempt)` per task, independent of Session and claim.

**Writer admission is determined by actual/potential side effects on a physical workspace, not by agent archetype or presence of workflow.** A read-only execution may omit a claim only if tools/transport are truly write-restricted; otherwise conservatively request ownership or reject unsupported unsafe mode.

| Scenario | Workflow attempt | Workspace claim | Git/ref coordination |
| --- | --- | --- | --- |
| Ad-hoc chat with no writable tools | No | No | No |
| Read-only review of spec | Optional | No when enforcement proven | No |
| Spec Writer editing source/spec files | Optional | Yes | Only for ref mutations |
| Implementer processing Task | Yes | Yes | According to actions |
| Human sign-off operation | Gate context | No physical writer for evidence-only step; transactional lock for evidence | No |
| Git worktree create/rebind/remove | Optional | Relevant affected workspaces | Yes, project/repository-scoped |
| Batch of Tasks in one managed Session | One identity **per** Task attempt | Claim scoped to shared physical workspace | As required |

Do not create a durable workflow attempt for every Turn. Execution claim is an admission/coordination resource; workflow step and provider Turn have separate lifecycles.

## Required claim identity

A candidate record includes `projectId`, `workspaceId`, opaque `executionId`, verified owner kind and ownership proof, declared scope/effects, current associated `turnId` **if managed**, optional set of task attempt refs, reservation/operation identity and observed settlement evidence. Do not persist duplicated canonical task status in the claim.

Short exclusive control locks protect inspect/compare-and-set. Long execution claims survive short CLI termination. The claim protects **cooperating** writers; a process with OS-level access can edit directly regardless of token.

## Claim recovery protocol (candidate behavior)

```text
inspect(workspaceId)
 -> prove no claim?                         -> available
 -> prove owner still executing?            -> active, report owner/context
 -> prove owner fully settled safely?       -> reconcile + compare-and-set release
 -> owner absent, operation replayable?     -> resume/reconcile exact operation, then release
 -> cannot determine side-effect outcome?   -> recovery-required with explicit actionable evidence
 -> operator requested controlled takeover? -> verify authority, record decision and fencing conditions
```

### Inspect (read only)

Expose active claim ID, owner class, scope, last known event, journal and workspace Git snapshot, blocking reason, **verified** liveness evidence if available, and allowed remediation actions. Never infer 'dead' solely from expired TTL or the PID of the short CLI invocation. Status should distinguish `recoveryRequired` from 'provider not running' and report unknown honestly.

### Reconcile (safe deterministic effects)

Under short control lock, re-read claim and journal, check terminal Runtime invocation evidence where Runtime actually owned the Turn, verify outstanding Git/filesystem operation stages, and settle only states with positive evidence. A proof of terminated provider may not prove all tool effects are settled. Idempotent stage replay requires operation intent+fingerprint and verified artifact identity.

### Release (compare-and-set)

Allow normal release only from proven owner/settled execution with expected claim revision. A trusted operator may request remediation or forced takeover only via **separately authorized, auditable** operation with documented preconditions, explicit warning and fencing/side-effect checks; never a blind `rm lockfile`. If safe preemption cannot be demonstrated, mark blocked and provide a manual inspection path rather than promising automatic recovery.

### Escalate

Explain why reclaim is unsafe, which actor must intervene, what evidence is missing and a bounded next action: resume same execution, inspect known running process, settle operation, repair workspace, or acknowledged takeover where supported. An unknown external agent may still have write access: a filesystem token alone cannot revoke that access. A forced release must not falsely claim physical isolation.

## Dirty baseline semantics

Do not make every dirty checkout categorically fatal. Resolve admission at the *specific action* and scope. Creation scaffold or known Engine-owned files can establish a declared baseline for a subsequent Spec Writer turn if proven, while unrelated changes, ambiguous provider writes and gate-declared clean-tree requirements remain blockers. A dirty baseline remediation action may be allowed **before** step activation; do not create a fake active workflow attempt just to clean up.

## Batch and handover

Batch scope is explicit, ordered, per-Task, never inferred from historical Session bindings. Releasing a Turn claim does not finish all Task attempts. Handover creates a new possible owner/Session after previous writer is safely released or fenced. It cannot silently transfer an opaque claim or auto-activate the next workflow transition.

## Acceptance and stage ownership

Foundation A proves project/worktree resource serialization for Spec creation; it does **not** need a fake `workflow step start`. Foundation B implements one real minimal workflow transition/claim plus inspect/reconcile/release for CLI without Runtime and tests collision/abandonment. Sessions integration later exercises Runtime managed owner against this same coordinator.

See [test plan](test-plan.md) for L, R, W, S stages. Claim outcome cannot be accepted if the only tested behavior is 'block forever'.
