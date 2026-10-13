---
id: ideas.specflow-engine.offline-agents
type: architecture
title: Offline CLI and external agent execution
status: draft
scope: specflow
areas: [ai, workflow, cli, runtime, security]
tags: [offline, external-agent, skills, session, cli]
read_when:
  - allowing agents launched outside SpecFlow Runtime to use workflow commands
  - mapping external workflow execution to optional Runtime observability
summary: >
  External agents use vendor-neutral skills and CLI to progress Engine workflow without a live
  Runtime, while provider-native conversations remain outside managed Session/Turn ownership.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.boundaries
  - ideas.specflow-engine.ownership
  - ideas.specflow-engine.locking
  - architecture.ai.provider-boundary
  - architecture.ai.canonical-session-turn-work
---

# Offline CLI and external agents

## Primary use case

A user starts Claude/Codex/Antigravity or another agent manually in the repository or worktree. The agent reads a SpecFlow skill, calls `nevo-specflow specs ...` and (when migrated) `nevo-specflow workflow ...`, edits files and supplies deterministic step-finish inputs. **Runtime is off throughout**. Workflow remains valid and repairable from files and Git. There is no assumption that a Runtime provider process or HTTP endpoint exists.

When Runtime is later started, it reads durable Spec/Workflow/claim state; it does not fabricate a historical Runtime Session, tools list or canonical provider Turn. UI may show an 'external execution / occupied workspace' indication if evidence supports it.

## Agent protocol sketch

```text
1. Skill discovers project, spec and registered workspace via CLI.
2. CLI resolves specId to one verified workspace root.
3. Skill requests readiness and starts a scoped workflow execution through Engine.
4. Engine issues execution identity/claim; agent changes code with cwd set to that workspace.
5. Skill invokes check/finish/resume commands with authoritative operation context.
6. Engine validates transitions, writes evidence, settles/relinquishes claim.
7. Runtime, if present, observes repository/journal changes independently.
```

The deterministic Engine decides step progression. Agent-written prose and prompt files are not evidence of approval or ownership.

## Session is optional correlation, not authority

Three independent identities:

- **Workflow task/step/attempt**: canonical deterministic progression.
- **Execution claim**: the authorized physical workspace writer for some interval.
- **Provider Session/Turn**: exists only for Runtime-managed AI work, or remains entirely outside SpecFlow when the agent was launched externally.

No forced `Session` record for external work. Future explicit opt-in attachment may link external provider metadata, but that is separate from workflow validity and not required for MVP.

## Execution credentials/open question

The first `step start` could issue a random opaque execution handle; future CLI calls must present credible ownership proof (or use a locally trusted same-user session mechanism). Passing an arbitrary `specId`, `taskId`, `sessionId` or owner name is not sufficient to take over another claim. Token storage, process inheritance and token disclosure in agent stdout/logs need an explicit security decision. CLI commands run with local filesystem authority, not HTTP identity; don't silently upgrade an arbitrary terminal to a configured Runtime user.

## Claim lifetime across CLI exits

An external agent may perform edits for minutes while no SpecFlow process runs. A short `flock`/lockfile around `step start` is insufficient; a durable claim covers the gap. A heartbeat is **not guaranteed** while the agent is thinking or editing, and a CLI PID dying after command completion is normal. Do not infer that the agent has stopped just because its last CLI process exited. Choose a clear explicit release/renewal/expiry/recovery policy; uncertain abandoned work must fail closed rather than auto-steal ownership.

The presence of an active claim still cannot prevent an uncooperative external process from editing; it protects cooperating operations. A skill must explain the protocol and must not promise OS-level write isolation.

## Runtime-managed agent path

Runtime owns provider spawn/lifecycle, canonical Session/Turn and interaction protocols. It calls the same Engine admission/transition operations, passing a trusted executor identity. Runtime termination reconciliation settles or marks uncertain its own active execution but **must not release external claims it never owned**.

Use the already documented provider-native resume compatibility model for managed Sessions; it includes workspace identity. Engine does not know provider-specific session-resume semantics.

## Skills and process working directory

Skills should first ask CLI to resolve the spec/workspace and operate in that root; never manually guess `../worktrees/<slug>`. Validate workspace linkage on each mutating command. Provider tooling may expose a fixed working directory per instance; when needed, launch/configure the external agent in the target worktree or use a supported per-command `cwd`. Do not assume changing shell cwd changes an already-created provider session's sandbox.

## Expected CLI surface (proposal)

```sh
nevo-specflow specs list --json
nevo-specflow specs resolve <spec-id> --json
nevo-specflow workflow inspect <spec-id> <task-id> --json
nevo-specflow workflow step start <spec-id> <task-id> --json
nevo-specflow workflow step finish <spec-id> <task-id> --input-file result.json --json
```

CLI stdout for machine JSON; diagnostics on stderr; stable nonzero exit codes for blocking/repair conditions. Avoid a command which silently launches Runtime for ordinary workflow.

## Security/compatibility tests

- Runtime stopped: CLI calls function end to end.
- Runtime running: another process cannot mutate a workspace claimed by an external agent.
- External claim/step progress appears in reads, but Session list remains unchanged.
- Wrong owner handle cannot finish/release another execution.
- Expired/unknown claim is not automatically overwritten if durable operation ambiguity remains.
- Managed Runtime provider turnover does not reset workflow attempt.

## End-to-end effect scope, not mandatory workflow

External CLI work may start as spec authoring before any Task exists. A writer claim covers a verified physical workspace and its intended effects, not a Task or Session lifecycle. Truly enforced read-only analysis does not require an exclusive writer. A new managed Runtime Turn follows the **same Engine admission contract** when it can write but remains a distinct Session/Turn lifecycle; see [execution scopes and recovery](execution-scopes-and-recovery.md) and [managed Sessions](managed-session-integration.md).

## Unblocking abandoned work

`recovery-required` is a diagnosis with an actionable remediation path, not a terminal workflow status. The proposed protocol separates read-only `inspect`, deterministic evidence-based `reconcile`, owner-scoped `release`, and separately authorized operator intervention with explicit limits on stale/unknown writer fencing. Missing heartbeat or a dead short-lived CLI PID is insufficient evidence of safe takeover. An unsupervised external agent with raw filesystem write access cannot be physically stopped by revoking a JSON claim; see [recovery contract](execution-scopes-and-recovery.md).

Human approval cannot be issued by claiming agent role/operator identity in an arbitrary CLI parameter. That separate trust question belongs to [local actors and human gates](local-actor-and-human-gates.md).
