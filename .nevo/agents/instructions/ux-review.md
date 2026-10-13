Use this procedure when reviewing an existing UX contract, mock, rendered screen, or implemented surface.

### Independent first-read before contract review

For an independent UX review of another designer's mock or rendered screen, this
pass takes precedence over the normal contract-first review order.

- Start with only the user's goal, entry point and unannotated, accessible
  interactive render. Do not read the intended first scan, author's layout
  rationale or owning screen contract yet.
- Record, before seeing the contract, what the screen appears to be for, the
  next meaningful action, where deeper information is found and what is
  confusing or disproportionately prominent.
- Only then inspect the contract and repository evidence to classify the
  observations. Do not rewrite the original first-read observations to match
  the author's intentions.

If a usable render or independent reviewer is unavailable, the required
first-read is **blocked**, not passed. If the reviewer has already seen the
author's rationale or intended hierarchy, disclose this limitation and obtain
a fresh independent first-read before claiming that gate passed.

For contract-only reviews or the designer's own self-review, use the normal
contract-first procedure below. Self-review is never independent review.

### Recover the intended task and contract

After the independent first-read, when applicable, identify:

- the user's goal;
- the owning product contract;
- the intended first scan;
- the main actions and decision points;
- the relevant states and responsive behavior.

Do not review only against personal visual preference.

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

### Report an explicit review outcome

Report the result for the requested UX scope, without creating a persisted
workflow status:

- **pass** — the independent first-read, when required, was performed and
  no material UX findings or unresolved decisions remain;
- **changes-required** — a material contract or implementation defect needs
  correction and a new review of the affected scenario;
- **owner-decision-required** — a material product choice cannot be resolved
  from the approved evidence; obtain the decision, update the contract and
  review the affected scenario again;
- **blocked** — required render, scenario, access or independent review is
  unavailable. Do not imply a review occurred.

Non-blocking refinements can accompany `pass`. A completed review with
unresolved material findings is not a passing review. If the owner explicitly
accepts a risk or changes the intended behavior, record that decision in the
owning contract and reassess the affected scenario; silence is not acceptance.

### Produce actionable findings

For each material finding provide:

- observed behavior;
- why it harms the user task or violates the UX contract;
- owning layer: contract or implementation;
- expected behavior;
- severity/priority;
- whether owner input is required.

If there are no material findings, say so rather than inventing polish work.
