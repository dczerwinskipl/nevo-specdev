---
id: product.specflow.ui.ai-session-ux
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
  information levels.
related:
  - product.specflow.ui.interaction-model
  - product.shared.vocabulary
  - design-system.principles.ui-ux-guidelines
  - architecture.ai.canonical-session-turn-work
---

# AI session UX

`status: draft` — working guidance, expanded as the code it governs lands. The canonical UI
model and exact component specs are defined with the implementation.

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

The chat is a **work interface**, not a raw transcript.

The primary Session stream preserves human-readable chronology across:

- user messages;
- assistant/final answers;
- Commentary when the provider/agent supplies it;
- compact semantic Work summaries;
- current activity and pending interaction state.

Commentary is first-class human context because it often explains what the agent is doing and why.
It is optional evidence, not guaranteed protocol data: never fabricate Commentary when a provider
does not supply it.

Raw tool calls/results do not dominate the normal conversation stream. They are represented by
compact semantic Work summaries and remain available through deeper Work inspection.

The final answer remains the primary outcome of a completed turn, while Commentary and Work preserve
the path/context needed to understand ongoing or completed work.

Reloading the page yields an equivalent view of the same Session (reload equivalence). The composer
preserves unsent text.

## Session association vs current execution

Every Session in the current product scope belongs to a Specification. A casual conversation with
no Task execution still has that Specification context; there is no project-global unassociated
Session collection in this scope.

Distinguish Specification ownership from the Session's current execution context:

- a casual Specification conversation, currently also used for non-deterministic preparation;
- deterministic execution of one or more Tasks;
- future deterministic execution/refinement of the Specification itself, not currently supported.

These are not immutable Session types. A conversation may later enter workflow execution through
the shared application/CLI operations. The UI reflects the authoritative execution context as it
changes without creating a replacement Session or inferring execution from the user's message.
Turn/activity updates must keep displayed execution context current through authoritative metadata
updates; this does not prescribe a request per Turn event.

A Session's historical/contextual Task associations do not prove what the current Turn is executing.

"Working on TASK-03" requires authoritative current execution scope. A generic/spec-level Turn can
occur in a Session that previously touched TASK-03, and one execution may legally cover a Task batch.

Do not select one representative Task for a batch execution merely to simplify presentation.

## Commentary vs reasoning

Commentary and reasoning are different canonical Work kinds.

- **Commentary** is user-facing progress/narration supplied by the agent/provider. It may appear as
  readable prose in the Session conversation and grouped Work log.
- **Reasoning** is separate thinking/reasoning Work. Active reasoning may justify a compact
  `Thinking…` current-activity projection, but historical reasoning is not automatically rendered
  as ordinary conversation text.
- A provider-supplied user-safe reasoning summary may be inspectable in Work, but the UI MUST NOT
  relabel raw reasoning as Commentary merely to make the transcript fuller.
- Both kinds remain canonical grouping boundaries in ordered Work.

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

## Current activity vs history

The user should be able to see **what is happening now** without opening full Work history.

Current activity belongs in the primary Session experience. Full chronological Work, action/tool
details, raw outputs, and diagnostics belong in contextual Secondary/deep inspection.

A settled Turn does not imply a completed Task/workflow attempt. When authoritative workflow state
allows continuation or requires recovery, the UI should expose that separately from the Turn's own
terminal state.

## Mobile

Work/inspection density is reduced on mobile; the primary answer, relevant Commentary, and
current-activity line are never dropped.

Because Secondary is not visible side-by-side on narrow layouts, the primary Session surface needs
explicit actions to open Context and user-selected inspection detail. Clicking a compact Work burst
may push expanded Work detail; a future file reference may push File preview once that capability
exists. Deep inspection moves behind deliberate taps and returns to the Session with Back.

Floating Session is Wide-only. Compact/Narrow existing-Session access opens Full Session directly.

Pending human interaction remains visible/actionable in the primary conversation on every
breakpoint. It does not auto-switch the user's Secondary/detail state.
