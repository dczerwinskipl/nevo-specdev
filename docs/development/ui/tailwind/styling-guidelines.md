---
id: development.ui.tailwind.styling-guidelines
type: development
title: Tailwind styling guidelines
status: draft
read_when:
  - composing Tailwind classes on a component
  - adding a component variant
  - mapping domain state to visual tone
  - deciding whether to use @apply or a CSS file
summary: >
  Class-composition pipeline: static local layout inline, reusable variants via cva,
  domain state resolved to a semantic tone before classes, explicit conditional
  composition, and a narrow @apply policy. Condensed from the upstream Nevo React
  guidelines §12.
related:
  - development.ui.react.component-guidelines
  - development.ui.ui-ux-guidelines
---

# Tailwind styling guidelines

`status: draft` — condensed from the upstream Nevo "Tailwind class composition"
section. Tailwind version and token file are confirmed when the dashboard migrates.

## 1. Local static layout

One-off layout for a single component: Tailwind classes inline on the element. No
abstraction.

## 2. Reusable component variants

A component with real variants (size, tone, emphasis) uses a variant utility
(`cva` / `tailwind-variants`) with named variants, not a pile of ternaries in JSX.

## 3. Domain state → tone → classes

Never map a raw domain value straight to color classes in markup. Resolve it in stages:

```text
domain state (e.g. task.status)
  → semantic tone (success | warning | error | info | running | neutral)
    → variant classes
```

The tone vocabulary is shared with the [UI/UX guidelines](../ui-ux-guidelines.md).
State uses color; type uses shape.

## 4. DOM and interaction state

Hover / focus / active / disabled / `aria-*` state uses Tailwind state variants
(`hover:`, `focus-visible:`, `data-[state=open]:`), not JS toggling classes.

## 5. Conditional composition

Compose conditional classes explicitly through a `clsx` / `cn` helper. Keep the
conditions readable; if a component needs a large conditional class matrix, that is a
signal to split it (see [React guidelines](../react/component-guidelines.md)).

## 6. Source detection

Tailwind's content/source scanning must see every file that produces classes. Don't
build class name strings by concatenation that the scanner can't follow
(`` `text-${color}-500` ``) — enumerate the full class names.

## 7. Multi-slot components

A component that styles several internal elements exposes per-slot class props or a
slot-based variant definition rather than leaking a single `className` onto an ambiguous
element.

## 8. CSS and `@apply`

Prefer utilities. Use a real CSS file with `@apply` only for a genuinely reusable
primitive (a base control style shared across many components) or something utilities
can't express. `@apply` is not a way to hide a long class list you didn't want to look
at.

## Inspection checklist

- [ ] Static one-off layout inline; real variants via a variant utility?
- [ ] Domain state resolved to a semantic tone before classes?
- [ ] Interaction state via Tailwind state variants, not JS class toggling?
- [ ] Conditional classes explicit and readable?
- [ ] All class names statically visible to Tailwind's scanner?
- [ ] `@apply` limited to reusable primitives?
