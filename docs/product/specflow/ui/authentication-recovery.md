---
id: product.specflow.ui.authentication-recovery
type: architecture
title: SpecFlow UI authentication recovery
status: current
read_when:
  - changing authenticated Runtime HTTP requests or session revalidation
  - adding an application-level HTTP error recovery policy
  - changing TanStack Query cache isolation or global auth redirects
summary: >
  Centralized Runtime authentication recovery, safe request replay, AuthStore
  concurrency, and authenticated Query cache isolation in SpecFlow UI.
related:
  - product.specflow.ui.application-architecture
  - product.specflow.ui.interaction-model
---

# Authentication recovery and navigation hardening

Authentication recovery is an application concern, separate from typed feature APIs. The HTTP transport remains product-neutral. The application coordinates session revalidation once, retries at most one safe read and treats HTTP 403 as resource-specific unless a contract explicitly declares app-wide denial.

Same-principal revalidation does not clear cached feature data. Authenticated identity changes and logout invalidate private cache before further feature rendering. Protected APIs are composed once; authentication endpoints use the raw transport to avoid recursive recovery.
