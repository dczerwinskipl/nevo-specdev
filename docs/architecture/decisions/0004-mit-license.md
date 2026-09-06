---
id: adr.0004-mit-license
type: adr
title: MIT license
status: current
date: 2026-09-05
summary: >
  The repository is licensed MIT — permissive, minimal obligations, sufficient for a
  public developer-tooling project. Provenance of any code brought in from another repository
  is checked per file when brought in.
related:
  - architecture.repository-structure
---

# 0004 — MIT license

## Status

Current.

## Context

The repository is public developer tooling and a framework. It has carried an MIT
`LICENSE` since its first commit. Its documentation and tooling are original to this
repository.

Apache-2.0 was weighed for its explicit patent grant and `NOTICE`-based attribution.
Those add ongoing obligations (carrying and updating a `NOTICE` file, recording
significant per-file changes) that are only worth taking on when third-party Apache-2.0
material is actually incorporated. No such material is present in this repository.

## Decision

- The repository is licensed under the MIT License (`LICENSE`).
- Root and package `package.json` files declare `"license": "MIT"`.
- `CONTRIBUTING.md` states that contributions are accepted under MIT.
- Revisit — as a superseding ADR — only if code under a license with stronger
  attribution or patent terms is incorporated.

## Consequences

- Downstream use has minimal conditions: keep the copyright and permission notice.
- MIT-licensed code composes cleanly into more restrictive projects later without a
  compatibility step.
- There is no patent grant beyond what MIT implies; accepted for the current scope.
- **Not settled by this ADR:** when code is later brought in from another repository, the
  licence and provenance of those specific files must be checked before they land here.
  Being under the same GitHub account is not by itself a relicensing authority — a file
  may carry a third-party copyright or a contributor's licence terms. That review belongs to the PR that brings the code in, not this one.
