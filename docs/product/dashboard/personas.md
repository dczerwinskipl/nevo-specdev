---
id: product.dashboard.personas
type: product
title: Dashboard personas
status: draft
read_when:
  - designing a dashboard screen or surface
  - deciding whether a capability belongs in the Dashboard or the CLI
summary: >
  Who uses the dashboard — the owner monitoring and steering work, and the reviewer
  checking a change — and what each needs from it. The dashboard observes and steers;
  it does not replace the CLI/PR workflow.
related:
  - product.dashboard.interaction-model
  - product.cli.personas
---

# Dashboard personas

`status: draft`.

## 1. Repository owner (monitor & steer)

Opens the dashboard to see the state of all active specifications at a glance, drill
into a task, watch an AI session stream, and take the one owner action that makes sense
at the current lifecycle step (approve a draft task, accept an implemented one,
finalize a change) after the same deterministic gate the CLI enforces.

Needs: an accurate overview without noise; live updates without manual refresh;
worktree/branch state visible; irreversible actions (finalize) behind explicit
confirmation.

## 2. Reviewer

Opens a change to understand what it does, read the spec against the implementation,
and inspect the attached pull request(s) and diffs. May not be the owner.

Needs: spec and PR side by side; clear "what changed" summary; read-only unless they
are also the owner.

## Boundaries

- The dashboard is **observational and steering, not authoritative**. It shows the
  state of specifications, tasks, changes and PRs and offers the same gated owner
  actions the CLI does — it is not a place where work is authored or where a second
  copy of the state is maintained, and it does not replace the CLI or the GitHub PR
  flow.
- Anything an agent or CI does is done through the CLI/workflow, not the dashboard.

> **Provisional:** the dashboard is intended to reflect the specification files and
> Git/PR state directly rather than own a separate datastore. Whether it is implemented
> exactly that way is a storage decision recorded in
> [`architecture/`](../../architecture/), not asserted here.
