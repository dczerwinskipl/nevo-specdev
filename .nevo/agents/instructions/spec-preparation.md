### 1. Classify the requested work

First identify the requested result, its product/technical surfaces (UI, backend, infrastructure, integration, or a combination), and its risk/uncertainty. Surface classification describes what the specification spans, not which agent will implement individual tasks.

Choose proportional depth: a bounded change with an established contract does not need a lengthy design exercise. Complex or uncertain changes require enough discovery to resolve material decisions before implementation. Keep exploration explicitly exploratory when implementation direction is not yet supported.

### 2. Reuse established decisions

Read the current owning product, architecture, engineering, and reference documents. Inspect relevant code/tests as evidence of present capability, without treating incidental implementation as a normative contract. Recover approved UX decisions from their authoritative home, not only conversation notes or mockups.

For UI-led changes, consume the UX Designer's durable contract and resolved decisions rather than
rerunning UX discovery or asking an already answered product question. When a genuinely new UX
choice remains, identify that specific gap for the owning UX profile. A separate manually selected invocation may be needed, but these instructions cannot switch profiles or restore private conversation context; use the durable UX handoff.

When ownership, infrastructure readiness, or contract reuse is uncertain, apply the reusable architecture-discovery procedure. Apply the existing backend-planning instruction when technical contracts are within agreed
specification scope, including backend-only changes. Consume the outcome already produced during
UX discovery without repeating it. Exact contracts remain in their authoritative code/reference
home; Spec Writer owns completeness and scope, not detailed task slicing.

For UI-led work, preserve approved information omissions, surface responsibilities, navigation/Back semantics, and UX acceptance scenarios. Turn them into observable acceptance criteria, not assertions that an API field or component is rendered. A missing backend contract is an explicit dependency, not permission to replace the approved user experience with fixtures or a technically easier flow. If feasibility changes the product behavior, return the conflict for a product decision rather than silently redesigning it.

### 3. Establish one specification boundary

Ask whether the requested result has one coherent objective and acceptance boundary. Look for independently useful shared capabilities that:

- have their own technical contract, ownership, or lifecycle;
- can be designed, tested, and reused without the original feature;
- unlock more than one consumer or need a separate architectural decision;
- should be completed before a dependent feature is production-ready.

For such a capability, recommend a separate related specification with an explicit prerequisite or integration contract. Keep it within the present specification when splitting would create only artificial coordination for one cohesive change.

State the proposed split, the reason, and what each specification owns. Do not create, approve, or silently expand other specifications on the owner's behalf. A dependency between specifications is not the same as an in-specification task `depends_on` edge.

### 4. Resolve and route material gaps

For every material capability required by the intended result, distinguish:

- confirmed existing contract/capability (with evidence);
- confirmed gap requiring its own planning or implementation;
- uncertain readiness requiring focused discovery;
- deliberate deferral outside the present scope.

A good UX contract alone is not proof that infrastructure or authoritative data is available. Record dependencies as outcomes and owning boundaries, without stuffing speculative implementation into the UX document.

Recommend a resolution when evidence supports it. Escalate only genuinely material product, scope, architecture, or cross-owner decisions; preserve unaffected work. Do not create a long approval ceremony for local implementation details.

### 5. Prepare a durable handoff

Use the appropriate existing specification/documentation home; do not introduce a new required document layout. Provide the smallest useful handoff describing:

- goal, non-goals, observable behavior, and acceptance scenarios;
- scope and owning surfaces, including recommended independent specifications;
- resolved material decisions and links to authoritative contracts;
- verified existing capabilities and remaining gaps or prerequisite outcomes;
- explicit readiness: ready for task decomposition, partially ready with isolated gaps, or blocked for a named decision.

A specification can be partially ready for decomposition: identify each decided portion and its
unresolved counterparts without calling the whole feature executable. Preserve the UX Designer's
already recorded backend scope choice; do not ask it again. The shared preparation-handoff semantics
provide the next profile exact decisions, owners, unblocking results and unaffected work.

Do not call a specification implementation-ready when an unresolved dependency would force an implementer to invent shared infrastructure, API semantics, or a material UX decision.

### 6. Check the handoff as a new reader

Before handing over, assess whether a task planner with only the durable specification and its linked sources could identify responsibilities, missing capabilities, testable outcomes, and the planned scope. If not, repair the contract or name the remaining blocker. Do not turn this into a duplicate UX review.
