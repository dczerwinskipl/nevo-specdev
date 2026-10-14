---
id: ideas.specflow-engine.recovery
type: architecture
title: Durable mutation journal and crash recovery
status: draft
scope: specflow
areas: [workflow, runtime, testing, configuration]
tags: [recovery, idempotency, journal, persistence]
read_when:
  - making multi-stage create or workflow operations retry-safe
  - reconciling crashes without a long-running daemon
summary: >
  Durable intent and stage evidence for recoverable worktree provisioning and workflow mutations,
  with offline CLI reconciliation, safe replay, and no fabricated Runtime sessions.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.spec-creation
  - ideas.specflow-engine.locking
  - ideas.specflow-engine.ownership
  - architecture.workflow.deterministic-workflow
---

# Durable operations and crash recovery

## Principle

A multi-stage mutation spanning JSON registry, YAML manifest, filesystem and Git cannot be made truly atomic with one file rename. The Engine therefore records durable intent and reconciles stage outcomes. Retrying the same logical command must not repeat a completed destructive stage. This must work when the next caller is a new CLI process with Runtime absent.

Workflow step start/finish already has useful record concepts in legacy Nevo; copy the evidence and contracts only after reviewing replay safety. The proposed create-Spec slice is a deliberately small test of this architecture.

## Creation operation stages (candidate)

```text
validated + reserved
 -> worktree-provisioned (optional)
 -> manifest-written
 -> registry-linked
 -> completed
```

Operation record includes a stable operation identity, requested spec/slug/workspace, target Git common-dir/branch/root, stage fingerprints, errors and data needed to prove each completed effect. Store journal under the coordination home's ignored state, not in committed Spec files.

The operation must be **idempotent by evidence**. A record saying "stage completed" is useful only if relevant filesystem/Git facts still match it. If the worktree path now belongs to an unrelated checkout, replay must stop. A mismatch is an explicit recovery conflict, not permission to overwrite.

## Mutation discipline

- Plan/read-only checks do not create claims, run tests, modify Git or persist a new finish operation.
- Separate validation/preconditions from side effects.
- Persist intent before an irreversible side effect.
- After each stage, write proof/revision that allows a later process to check if it already happened.
- Use atomic local writes and controlled versions for journal records.
- Terminalize success/failure only with an evidenced final state; keep ambiguous records for inspection and explicit repair.
- Provide read-only `inspect operation` plus safe `retry/reconcile` rather than deleting unknown records on process restart.

## Example crash outcomes

| Crash                                        | Next action                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Before intent                                | No mutation happened; normal create can retry                                                 |
| After reservation                            | Revalidate, continue or release reservation if unmodified                                     |
| After Git worktree creation, before manifest | Verify worktree membership and ownership then resume manifest                                 |
| After manifest write, before registry        | Match specId and intent before binding; never silently create duplicate                       |
| After registry write, before response        | Return existing canonical result                                                              |
| During locked JSON rewrite                   | Parse validated old/new state or fail with repair instruction                                 |
| After one workflow finish effect             | Resume only uncompleted stages proven safe                                                    |
| During worktree deletion                     | Keep cleanup intent; recheck existence/branch and do not accidentally remove a different path |

Recovery should be driven by the next Engine operation/readiness reconciliation or explicit command; no permanent server is required. Runtime boot may trigger the same reconciliation but does not override the Engine.

## Claims and cancellation

Journal identity, execution claim and workflow attempt are distinct. Finishing/clearing a claim does not imply completing the step. On Runtime shutdown, managed providers are cancelled and their claimed writes are reconciled; external claims are not forcibly removed. An ambiguous write may block subsequent conflicting actions until reconciliation succeeds.

## Persistence and safety details to resolve

- Crash-consistent atomic write strategy on Windows and POSIX; test fsync/rename/fallback behavior.
- Multiple node processes accessing one registry; consistent lock ordering.
- Schema evolution and migrations for local state records.
- Retention/compaction after terminalization while preserving enough evidence for idempotent retry.
- Local backup/debug support and sensitive-data redaction.
- Whether project state home survives moving the primary worktree; no silent reinitialization with loss of open operations.
- Protection against stale operation ID reused for different inputs (fingerprint or immutable intent).

## No optimistic cleanup

If an operation has created a managed worktree and fails later, automatic rollback is allowed only after proving no new user edits and exact ownership. Otherwise return a repairable state with clear paths and identifiers. Never run force clean/reset/remove simply to restore a pleasing initial state.

## Verification

Kill subprocess at each stage and start **a fresh process** to recover. Assert no duplicate Spec/branch/worktree, no lost registry update, same canonical result for same operation ID, structured conflict if filesystem diverges, and no requirement to start the HTTP Runtime. See [test plan](test-plan.md).

## Two independent recovery authorities

Creation/rebind/workflow operations use Engine-owned durable journals. Runtime-managed provider invocation needs a **separate** durable dispatch intent and Turn lifecycle; the Engine claim and Runtime invocation may correlate, but neither journal replaces the other. If Runtime crashes after provider spawn and before correlation is stored, provider work is **unknown** and automatic replay is unsafe. Runtime may settle its Turn while Engine workflow remains unfinished; claim release requires its own proof. See [managed execution integration](managed-session-integration.md).

For an external CLI writer, `recovery-required` should include proof requirements and an action plan: inspect claim and Git/current artifacts, reconcile idempotent stages, safely release verified terminal work, or escalate when the agent may still write. Never delete the only available worktree or forge successful human review to clear a blocked state. See [execution-scopes recovery](execution-scopes-and-recovery.md).

## E2.T04 recovery procedure for local create

The Engine's short Project Home control lock and its durable creation journal are
separate evidence. Inspect both before an operator retries an interrupted create:

1. Read the create record using `inspectCreateSpecification(engine, operationId)`
   and the lock using `inspectProjectControlLock(context)`. Preserve the state
   files in `.nevo/local/state/engine/operations/create/`, any `*.tmp` files,
   and `.nevo/local/state/engine/control.lock` before manual repair.
2. Identify the original writer and any descendant Git processes **independently**;
   an absent PID or elapsed timeout alone cannot prove termination. If work may
   still be running, do not release its lock or replay its operation.
3. For `git-initiated`, prove process quiescence **and** inspect the expected Git
   branch, path, worktree membership, base commit, and checkout identity. Only
   then may an explicit trusted operator request a retry with
   `confirmInterruptedGitSettled: true`. A partial ref, unexpected path or
   substituted identity is a recovery conflict, not permission to recreate.
4. A stranded `control.lock` or unpublished atomic `*.tmp` remains in place
   until manual investigation. After independently proving there is no writer
   and preserving the evidence, an operator may remove the verified orphan
   lock and archive the abandoned temporary file **out of** the journal
   directory. Never erase an authoritative published journal or override an
   unknown lock. If evidence is inconclusive, stop and escalate.
5. Reopen the Engine in a new process with the **same** `operationId` and
   immutable input. It verifies stage effects against Git/FS/registry. Never
   force-clean, reset, or prune an uncertain checkout to unblock creation.

**Discovery admission policy (E2.T04):** create is deliberately blocked when
any bound canonical Spec has `workspace_unavailable` or `manifest_missing`.
The local registry currently stores `specId → workspaceId`, not a durable
authoritative slug for every Spec. Allowing new creates while part of that
namespace is unreadable would violate global slug uniqueness. A future narrower
policy requires a validated, coordinated slug-ownership record and recovery
contract; this checkpoint does not silently infer it from stale primary copies.
