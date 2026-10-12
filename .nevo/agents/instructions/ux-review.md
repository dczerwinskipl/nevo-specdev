Use this procedure when reviewing an existing UX contract, mock, rendered screen, or implemented surface.

### Recover the intended task first

Identify:

- the user's goal;
- the owning product contract;
- the intended first scan;
- the main actions and decision points;
- the relevant states and responsive behavior.

Do not review only against personal visual preference.

### Independent first-read pass

When reviewing another designer's mock or rendered screen, start with the rendered result and a minimal user scenario (goal and entry point), before reading the author's layout rationale. Try to identify the screen's purpose, the next meaningful action, and where deeper information lives. Record what is unclear or unexpectedly dominant, then inspect the approved contract and evidence to distinguish a contract defect from an implementation defect. Do not call a self-review independent; do not accept a screen solely because it matches its own mock or design system.

### Inspect evidence

Review the rendered/composed product when available, not only source code or isolated components.

Use current documentation and approved references to distinguish intended behavior from accidental implementation.

When explicit owner decisions are available, verify that the durable contract actually preserves them. Treat a decision that was dropped, materially weakened, or reopened as an alternative after it had been resolved as a contract defect.

### Classify findings

Classify material issues as one of:

- **contract defect** — the documented UX itself is insufficient, contradictory, or wrong for the user task;
- **implementation defect** — the contract is sound but the rendered behavior violates it;
- **unresolved product decision** — the correct behavior cannot be determined from current evidence;
- **non-blocking refinement** — the behavior is acceptable but could be improved without changing the product contract.

Do not disguise a contract problem as a CSS tweak.

### Review in user-task order

Check:

1. decision closure: resolved owner choices are normative and rejected alternatives are no longer viable;
2. first scan and information priority;
3. task flow and discoverability of the next action;
4. grouping and progressive disclosure;
5. state changes, interruption, and recovery;
6. action semantics and consequential decisions;
7. context preservation and Back/detail behavior;
8. responsive preservation of meaning;
9. information density and repeated-unit rhythm;
10. accessibility-relevant interaction semantics;
11. stress/edge scenarios that can materially break the experience.

### Avoid review-driven redesign

Do not replace an established pattern merely because another layout is plausible.

For each proposed change, state what user problem it fixes and what contract/invariant it restores or intentionally changes.

### Produce actionable findings

For each material finding provide:

- observed behavior;
- why it harms the user task or violates the UX contract;
- owning layer: contract or implementation;
- expected behavior;
- severity/priority;
- whether owner input is required.

If there are no material findings, say so rather than inventing polish work.
