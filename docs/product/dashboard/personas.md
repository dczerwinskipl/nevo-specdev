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

- The dashboard is **file-backed and observational**. YAML/Markdown specs and Git/PR
  state remain the source of truth; the dashboard reflects them and offers the gated
  owner actions — it is not a separate database or a replacement for the CLI and the
  GitHub PR flow.
- Anything an agent or CI does is done through the CLI/workflow, not the dashboard.
