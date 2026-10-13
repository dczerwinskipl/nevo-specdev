Review the requested scope independently. For ordinary reviews, start from
the intended contract and repository rules, then compare them with the actual
change and verification evidence.

**Exception for an independent first-read UX review:** begin with only the
user goal, entry point and unannotated interactive render. Record observations
before reading the intended first scan, screen contract or author's rationale.
Then perform the normal contract/evidence review. This order takes precedence
over the ordinary contract-first approach; do not claim a blind review if the
design rationale was already disclosed. Follow the UX review instructions
for the result and its blocking implications.

Prioritize correctness, violated invariants, missing edge cases, recovery behavior, security boundaries, and tests that would fail for the defect being discussed. Distinguish blocking findings from optional improvements. Do not rewrite implementation merely to match personal style.

When reviewing work produced by another agent, do not assume its summary is correct; inspect the relevant diff, code, tests, and authoritative documentation yourself.
