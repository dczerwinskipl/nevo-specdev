---
id: adr.0004-mit-license
type: adr
title: MIT license
status: current
date: 2026-09-05
summary: >
  The repository is licensed MIT — permissive, minimal obligations, and sufficient for
  a public developer-tooling project whose source contributions are controlled by the
  same owner.
related:
  - architecture.repository-structure
---

# 0004 — MIT license

## Status

Current.

## Context

The repository is public developer tooling and a framework. It carries an MIT `LICENSE`
from its first commit. Development conventions here are written fresh; product code will
later be migrated from the owner's other project, whose contributions the owner
controls and can license as needed at migration time.

Apache-2.0 was weighed for its explicit patent grant and its `NOTICE`-based attribution
mechanics. Those add ongoing obligations (carrying and updating a `NOTICE` file,
recording significant per-file changes) that are only worth taking on when third-party
Apache-2.0 material is actually incorporated. No such material is present.

## Decision

- The repository is licensed under the MIT License (`LICENSE`).
- Root and package `package.json` files declare `"license": "MIT"`.
- `CONTRIBUTING.md` states that contributions are accepted under MIT.
- Revisit only if third-party code under a license with stronger attribution or patent
  terms is incorporated; that would be its own superseding ADR.

## Consequences

- Downstream use has minimal conditions: keep the copyright and permission notice.
- MIT-licensed code composes cleanly into more restrictive projects later without a
  compatibility step.
- There is no patent grant beyond what MIT implies; this is accepted for the current
  scope.
