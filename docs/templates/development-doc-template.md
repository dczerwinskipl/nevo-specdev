# Development / product / architecture doc template

Copy this file to the right place under `docs/`, delete this notice, and replace the
example frontmatter with a real `---`-delimited block. This template deliberately has
**no** frontmatter — `docs/templates/**` is exempt from the frontmatter
requirement `nevo-docs` enforces everywhere else.

## Frontmatter to add at the top of the real doc

```yaml
---
id: <area>.<slug> # e.g. development.git-workflow — unique across docs/
type: development # development | product | architecture (adr uses the ADR template)
title: <Title>
status: current # current | draft | deprecated | superseded
read_when:
  - <a concrete trigger, phrased as an activity>
  - <another trigger>
summary: >
  One or two sentences: what this document governs and what the reader comes here to
  learn.
related: # optional; each id must resolve to another indexed doc
  - <area>.<slug>
---
```

## Body guidance

- Lead with the rule or the shape, not history.
- Prefer tables and short sections over long prose.
- State guarantees explicitly; mark anything provisional as `draft` in `status` and say
  so in the text.
- Link siblings with relative Markdown links; link concepts with `related` ids.
- Do not put React/Tailwind implementation detail in a `product/` doc, and do not put
  personas or UX behavior contracts in a `development/` doc.
