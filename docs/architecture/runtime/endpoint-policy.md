---
id: architecture.runtime.endpoint-policy
type: architecture
title: Runtime endpoint policy
status: current
scope: specflow
areas: [runtime, server, security]
tags: [http, rate-limit, endpoint-policy]
read_when:
  - adding Runtime HTTP endpoints or expensive operations
  - configuring shared request limits and Auth exceptions
summary: >
  Server-owned default source request budget, feature-owned stricter Auth limits,
  project configuration ownership and truthful HTTP 429 responses.
related:
  - architecture.runtime.configuration
  - architecture.runtime.authorization
  - reference.api.task-reads
---

# Runtime endpoint policy

The Runtime composition root registers `@fastify/rate-limit` once, before feature routes.
All registered endpoints inherit a shared default source budget: **300 requests per 60 seconds**.
Adding a new Task, Document, Specs or other route does not require an explicit limiter call.
The default also covers Runtime metadata, Auth session/discovery reads and web application routes.

Auth owns stricter route policies for password login and OIDC start: **10 attempts per 60 seconds**
at each configured endpoint. Those route overrides use independent counters, so exhausting the
default resource budget does not consume or replace the login budget. Existing account-level
password throttling remains a separate protection.

## Ownership and configuration

Server composition owns the shared mechanism and default budget. Features own exceptions for
the cost/security of their operations through Fastify's supported `config.rateLimit` metadata.
An exception MUST have an explicit owner and reason; a new route MUST NOT silently disable
the default policy. Authorization remains mandatory and separate from request admission.
This policy does not define workflow or command permissions.

The default budget may be tuned in the project's `.nevo/config.yaml` (fragment):

```yaml
runtime:
  server:
    rateLimit:
      max: 300
      timeWindowMs: 60000
```

Omitted values retain defaults. `max` is an integer 1–1,000,000; `timeWindowMs` is an integer
1–86,400,000. Boolean disable switches, unknown keys and non-finite values are rejected.
The setting is project-owned; `.nevo/local/config.yaml` cannot override it. Tuning the default
does not change Auth's stricter route overrides.

## Admission and response

Counters use the peer IP, with IPv6 addresses grouped by /64. Runtime does not trust arbitrary
forwarded headers as client identity. The limiter runs before route handlers and their readers.
Excess requests return **429** with `error: rate_limited`, `Retry-After`, rate-limit headers and
`Cache-Control: no-store`. A fresh configured window restores the budget.

Counters are bounded in-memory state (5,000 source keys per store) for one Runtime process.
They reset on restart and are not a distributed abuse-prevention service. Authentication,
authorization, bounded source reads and application capacity controls remain independent.

HTTP regressions cover cross-route shared budgets, automatic protection of a new route, reader
non-execution after rejection, source isolation, forwarded-header spoofing, Auth/default budget
separation, window renewal and project/local configuration ownership.
