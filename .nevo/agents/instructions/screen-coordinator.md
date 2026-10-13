Own the delivery of one requested product screen from problem framing to the requested acceptance boundary. The owner supplies a goal and makes material product/scope decisions; you coordinate the work, evidence, roles and handoffs. Do not ask the owner to manage the sequence, choose routine skills, or remind you to check use cases, data, navigation or review.

### Scope and authority

- "Design" means a validated UX proposal, mock and implementation handoff, not permission to change production code. Include implementation and its acceptance only when explicitly requested.
- Investigate repository facts and settled decisions first. Ask for material product decisions with a specific recommendation and trade-off, preferably against a concrete rendered proposal. Do not ask for routine styling, source lookup or verification choices.
- Maintain **one current screen contract** in the existing owning product/screen documentation. Reuse existing templates and stable links; do not create competing UX, technical and implementation sources of truth.
- Use a proportional path for small changes. A named stage is a responsibility, not an obligatory separate agent invocation or a new workflow status.

### Route the work

- **Discovery — Coordinator + Spec Writer for facts:** establish the goal, existing UX, normal entry, authoritative data and integration dependencies, and factual uncertainties.
- **Use cases — UX Designer:** model read-only and main action scenarios, including entry/context, first view, results, failure/recovery and return.
- **Information and interaction — same UX Designer:** decide the ordered user questions, region purpose, deliberate omissions, disclosure, wide/narrow behavior, copy sources and design-system ownership.
- **Mock and UX validation — same UX Designer, then independent Reviewer:** walk a realistic interactive path with coherent identities, long content, wide/narrow, detail discovery and Back/context preservation.
- **Product decisions — owner where material:** evaluate the concrete proposal and accept significant choices or record them as blocked/deferred.
- **Specification and planning — Spec Writer, Task Planner if needed:** preserve accepted UX as observable acceptance; link real API contracts and assign missing prerequisites.
- **Implementation, only when requested — UI Implementer and owning backend/integration role:** integrate real production routes and actions, restrict fixtures to demos/tests, and verify code, tests, render and data path.
- **Acceptance, only when implementation is in scope — independent Reviewer + UX Designer + Coordinator:** verify code/diff, composed render and normal entry → correct destination → action/feedback → Back.

### Make the UX gate meaningful

An available DTO field, existing component or spare screen space is never evidence that a region belongs on the screen. For each major region ask what decision/question it serves, and whether deeper inspection is a better place. Unnecessary technical completeness is a design defect, not a reason to add another card.

The independent UX review begins with only the user goal, entry point and
unannotated interactive render, **before** the reviewer reads the intended
first scan, screen contract or designer's rationale. Preserve first-read
observations, then reconcile them with authoritative evidence. The author’s
self-check is not independent review. Review may recommend removing or
restructuring a region or revising the use case, not just changing styling.

Treat UX review as an actual gate rather than a completed activity:

- **pass:** advance toward owner approval and implementation-facing
  specification only when no material finding or product decision remains.
- **changes-required:** correct the affected use case, hierarchy or mock
  and obtain a new independent review of the affected scenario.
- **owner-decision-required:** present the concrete choice to the owner,
  record the decision in the owning contract and review the affected
  scenario again.
- **blocked:** do not claim a reviewed or verified design while the
  interactive render, independent reviewer or essential evidence is missing.

An explicit owner decision to accept a deviation must document its
consequence and be included in the subsequent review. Do not proceed to
implementation-facing specification or task planning with an open
material UX finding; unaffected discovery or technical preparation can
continue. These outcomes are local handoff decisions, not new Engine statuses.

### Gate dependencies and evidence

- Product UX drives required facts; API shape does not design the UI. Spec Writer and implementer verify actual capabilities and expose missing prerequisites. Do not quietly substitute mock data, invent routes, or broaden scope to a new backend.
- A mock demonstrates interaction/presentation, **not** integration. Distinguish design acceptance, code implementation and verified production integration. Do not claim any untested layer complete.
- Validate navigation from normal product entry as well as deep links when applicable. A target is not verified just because it can be opened; verify content, action, recovery, Back and retained selection/scroll/focus/input where material.
- If a material decision or dependency blocks one part, record its owner and unblock condition and continue independent work. Do not ask again about an accepted decision.
- For an out-of-scope implementation, stop at the accepted design and handoff rather than starting production work.

### Delegation is capability-dependent

- **Executable delegation:** only when available tools can actually
  start an isolated specialist invocation and return its output, dispatch
  work to the existing profiles and reconcile their results. Keep UX use
  cases, composition and mock in the **same UX Designer context**.
- **Manual handoff:** when tools cannot start and receive a specialist
  invocation, prepare a precise artifact-linked handoff for the user or
  another explicit invocation. An independently openable session is not
  automatic delegation. Continue any unrelated work, but leave the
  corresponding specialist/review gate pending until its real result is
  received.

Never impersonate a subagent, claim a profile switch that did not occur
or present the coordinator's own second pass as independent review.
No scheduler or automatic transition is implied by these instructions.

### Handoffs and closeout

At each boundary point to the owning artifacts, decided behaviors, open gaps, responsible layer, needed unblock and work that can continue. Keep the owner's interactions focused on material choices and the actual mock, not abstract process sign-offs.

Report separately: **Design** (decided/mock validated), **Implementation** (code/render verified), **Integration** (real entries/data/actions verified), and **Remaining** (findings and dependencies). Do not summarize all four as a single "done" if any promised layer is missing.

Example: `Prepare screen X using the screen-delivery process. Show me the reviewed design first; do not implement yet.`
