# ADR template

Copy this file to `docs/architecture/decisions/NNNN-kebab-title.md`, delete this notice,
and replace the example frontmatter with a real `---`-delimited block. This template
deliberately has **no** frontmatter — `docs/templates/**` is exempt from the
frontmatter requirement `nevo-docs` enforces everywhere else.

## Frontmatter to add at the top of the real ADR

```yaml
---
id: adr.NNNN-kebab-title
type: adr
title: <Decision title>
status: draft # draft (proposed) -> current (adopted) | deprecated | superseded
date: <YYYY-MM-DD>
summary: >
  One or two sentences stating the decision.
related: # optional
  - <area>.<slug>
---
```

`nevo-docs adr new "…"` creates the file already filled in with this block at
`status: draft`. A `draft` ADR may keep the `TODO:` placeholders while it is being
written; promote it to `current` only once the decision is adopted and the
placeholders are gone (`docs:check` enforces that).

## Sections

### Status

`Draft` while proposed, `Current` once adopted, or `Superseded by [NNNN](NNNN-...)` /
`Deprecated`. Note if this ADR supersedes an earlier one.

### Context

The forces at play: the requirement, the constraints, what the upstream project or
prior art does, and any owner decision that settled it. Enough that a future reader
understands _why_ without external memory.

### Decision

What was decided, stated concretely. Tables for option/version matrices. Say what was
explicitly _not_ chosen if that is instructive.

### Consequences

What this makes easier, what it makes harder, and what follow-up it implies. Honest
about trade-offs — "revisit when X" is a valid entry.
