---
id: ideas.specflow-engine.plan-02.task-09
type: engineering
title: 'E2.T09 — Normalize Specification manifest and Create journal'
status: draft
scope: specflow
areas: [workflow, cli, testing]
tags: [execution-task, temporary, specification-contract, pre-release]
read_when:
  - implementing or reviewing E2.T09
summary: >
  Establish one canonical specification.yaml and one strict current Create journal,
  without prototype-only backward compatibility; retain durable recovery guarantees.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.spec-creation
  - ideas.specflow-engine.specification-worktree-closure
---

# E2.T09 — Normalize Specification manifest and Create journal

This task is part of the existing PR #53. **Pre-release contract rule:** formats created only by earlier, unreleased PR commits are not compatibility commitments. No permanent adapters, legacy renderers, v1 codec or automatic migration. Preserve crash safety for the current format.

## Product contract

- One Specification manifest: `specs/{active|archive}/{slug}/specification.yaml`, with valid Spec identity, definition and lifecycle metadata.
- No `workflow.mode` or other execution-mode selector; deterministic orchestration is intrinsic.
- One strict current Durable Create journal (`version: 2`), with immutable request intent, generated date, physical checkout identity, exact scaffold paths and SHA-256 evidence, plus CAS-controlled progress.
- Old `change.yaml` directories, unsupported journal versions and obsolete scaffold hashes fail closed with actionable repair/recreate guidance; **never** silently reinterpret, overwrite, rename or delete user files.

## Implementation

1. Remove `createLegacySpecificationScaffold` and the legacy/current renderer fork. The new renderer writes only `specification.yaml`.
2. Remove `CreateJournalV1`, old v1 fingerprint/HEAD fallback and compatibility branches from journal codec, reservation and Git planning. Keep one closed discriminated model for existing checkout versus new managed worktree. Preserve explicit client omission versus override in pinned v2 intent.
3. Repository/discovery/canonical-source accepts exactly correctly cased `specification.yaml`. A `change.yaml`-only directory, both filenames, symlinks, path redirection, invalid slugs or duplicate identities fail closed. No mode-field fallback.
4. Retain strict durable journal validation (fingerprint, file list, canonical path, Git instance, workspace incarnation) and stage-based idempotency. Existing uncompleted records of the CURRENT format resume only via trusted explicit operator recovery. Normal CLI/HTTP retry must not silently take over an active writer.
5. Verify real process SIGKILL at reservation, Git mutation, manifest write and registry publication where already covered. Verify unknown Git effects, tampered scaffold and conflicting operationId fail closed. Retain Windows/macOS/Linux evidence.
6. Replace prototype-migration tests with positive current-format coverage and negative tests rejecting obsolete versions/paths. Do not delete unrelated version-control capability regression tests.

## Acceptance

- New create and canonical read produce `specification.yaml`, no execution-mode field.
- Only the current journal format is accepted; obsolete `version: 1` and `change.yaml` are rejected, not upgraded.
- Current journal recovery remains idempotent and SHA-256/CAS safe after process failure; the public retry remains observation-only.
- Full Quality, Engine, real Git/filesystem, Windows/macOS and CI checks pass. Independently review the current code and negative cases before beginning T10.
- Gate IDs: LC30, LC34, LC35 and LC36. T10 depends on this completed scope.

## Pre-release contract policy for PR #53

Until a released version or verified real user data requires migration, change internal contracts directly rather than accumulating backward compatibility. Any exception needs a documented real-world data requirement and a separate explicit migration plan. This does **not** relax durability, recovery, concurrency, filesystem safety or authorization requirements.

## References

- [Plan 02](../README.md)
- [Closure design](../../../specification-and-worktree-close-design.md)
- [Spec creation](../../../specification-creation.md)
- [Test plan](../../../test-plan.md)

Temporary execution plans are removed before final PR #53 merge as required by the program runbook.
