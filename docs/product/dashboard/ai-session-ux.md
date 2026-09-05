---
id: product.dashboard.ai-session-ux
type: product
title: AI session UX
status: draft
read_when:
  - designing the chat / session workspace
  - presenting AI turn state, tool activity, or reasoning
  - deciding what belongs at each Work information level
summary: >
  How an AI session is presented: canonical semantics first, immediate turn feedback,
  "thinking" needs evidence, "waiting" is not "needs attention", and the four Work
  information levels. Condensed from the upstream Nevo AI UX guidelines.
related:
  - product.dashboard.interaction-model
  - product.shared.terminology
  - development.ui.ui-ux-guidelines
---

# AI session UX

`status: draft` — condensed from the upstream Nevo AI UX guidelines. The canonical UI
model and exact component specs are defined during migration.

## Model

- **Canonical semantics first.** The UI renders a provider-neutral canonical model
  (turn, work item, tool kind, tool status). Raw provider protocol payloads
  (Anthropic, OpenAI, …) never reach components or fixtures.
- **Do not duplicate canonical state.** One source per fact; derived views compute from
  it, they don't store their own copy.

## Turn state

- **Immediate feedback.** Submitting a message visibly changes state at once.
- **Thinking requires evidence.** A "thinking"/"working" indicator is shown only when
  something is actually progressing — not as a decorative default.
- **Waiting is not attention.** A turn passively waiting (e.g. on a tool) is styled
  calmly; reserve alert styling for states that need the user.
- **Tool failure ≠ turn failure.** A failed tool call within a still-progressing turn
  is a different state from a failed turn.
- **Historical success loses emphasis.** A completed successful step is quieter than
  the live one.

## Chat

The chat is a **work interface**, not a transcript. The agent's final answer is the
primary content of a completed turn. Reloading the page yields an equivalent view of
the same session (reload equivalence). The composer preserves unsent text.

## Work information levels

| Level  | Name           | Prioritizes                                                      |
| ------ | -------------- | ---------------------------------------------------------------- |
| **L1** | Summary / Now  | The single most useful "what is happening / what happened" line. |
| **L2** | Expanded Work  | Recent history + current activity, semantically grouped.         |
| **L3** | Work details   | An inspection list of steps.                                     |
| **L4** | Action details | Technical inspection of one step (command, args, output, error). |

Specificity increases with depth. Inspection-only data (raw output, internal ids) stays
at L3/L4 — never promoted to L1/L2. Hidden levels must be discoverable.

## Live vs historical

A session view distinguishes a **live** turn (streaming, updating) from a **historical
snapshot** (settled). Live updates apply without a manual refresh; a historical view
does not silently mutate.

## Mobile

Work/inspection density is reduced on mobile; the primary answer and current-activity
line are never dropped. Deep inspection moves behind a tap.
