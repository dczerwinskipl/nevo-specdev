---
id: architecture.runtime.configuration
type: architecture
title: Project configuration and local state
status: current
read_when:
  - adding or moving SpecFlow configuration
  - deciding whether a setting is committed or workstation-local
  - adding Runtime-owned local persistence
summary: >
  Nevo SpecFlow uses one .nevo namespace: committed project configuration and definitions,
  ignored workstation-local configuration, and application-owned local Runtime state.
related:
  - docs.architecture-runtime-readme
  - architecture.runtime.ownership-and-lifecycle
  - reference.cli.nevo-specflow-contract
  - architecture.runtime.endpoint-policy
---

# Project configuration and local state

Nevo SpecFlow uses one repository namespace:

```text
.nevo/
├── config.yaml                 # committed product configuration container
├── agent-instructions.md       # committed
├── agents/                     # committed definitions/instructions
├── workflows/                  # committed deterministic workflow definitions when migrated
└── local/                      # entirely Git-ignored
    ├── config.yaml             # workstation/operator configuration + secrets
    └── state/                  # application-owned local persistence as capabilities migrate
```

The canonical ignore entry is:

```gitignore
.nevo/local/
```

Do not introduce a sibling `.nevo-local/` namespace.

## Ownership

The product owns the **configuration containers and composition**, not the meaning of capability
settings. It owns Git-root discovery, the `.nevo/` namespace, file locations, ignore rules,
serialization, and the top-level namespaces contributed by capabilities.

Current shape:

```yaml
runtime:
  server: ... # optional rateLimit is project-owned server policy
  authentication: ...
  authorization: ...

specs:
  overview:
    current:
      sections:
        - requires-attention
        - active
        - ready
        - draft
```

Runtime infrastructure owns composition and file loading, while feature modules own the meaning of
their configuration. Auth owns `runtime.authentication` and `runtime.authorization`; server
composition owns `runtime.server`; Specs owns the top-level `specs` namespace.

Configuration dependencies flow in one direction:

```text
config/parsing primitives
        ↓
feature-owned configuration
        ↓
Runtime config composition/loading
```

`config/parsing/` contains only low-level configuration parsing support such as
`RuntimeConfigError` and reusable value parsers. Feature configuration depends on those primitives,
not on Runtime config loading or composition. Feature configuration parsers are exposed through each
Runtime feature boundary and invoked by the configuration composition layer. Infrastructure must not
reproduce feature-specific validation.

Runtime initialization (`initRuntime`) owns Auth/server setup prompts, defaults, project/local
split, password hashing, secret policy, merge rules, and effective-config validation. Specs Overview
section configuration is optional project policy and defaults to the standard Current section order.

The product initializer calls `initRuntime`, wraps its contribution under `runtime`, and writes
the aggregate documents without reconstructing Runtime settings.

Server provenance is explicit too: `host`, `port`, `publicOrigin`, and `tls.enabled` are
project-owned policy, as is the optional shared endpoint `rateLimit` budget described in
[Runtime endpoint policy](endpoint-policy.md). Workstation-local Runtime config may supply only TLS certificate/key paths.
The merged Runtime config is validated after composition, so local credentials cannot weaken
project-owned authentication or server policy.

This namespace boundary is deliberate. Future AI, workflow, repository, or integration
configuration can add their own top-level capability namespace without becoming an unknown Runtime
key. Runtime config loading extracts only `runtime` before applying Runtime validation.

## Project versus local

`.nevo/config.yaml` contains source-controlled configuration that should follow the project.

`.nevo/local/config.yaml` mirrors the same capability namespaces for workstation-specific values
and secrets. It is **not** a general override layer. Provenance is validated before merge.

Current ownership is explicit:

- `server`: project owns `host`, `port`, `publicOrigin`, and `tls.enabled`; local owns
  `tls.certFile` and `tls.keyFile`.
- `authentication`: project owns `mode`, `users`, provider `enabled`, and OIDC
  `issuer`/`clientId`/`allowedEmails`; local owns `localUserId`, password `accounts`, and
  OIDC `clientSecret`.
- `authorization`: project-owned role assignments; workstation-local authorization is rejected.
- `specs.overview.current.sections`: project-owned ordered Current Overview sections; local Specs
  configuration is rejected.

A local file that attempts to set project-owned policy is rejected before composition. Likewise,
project config cannot contain local-owned credentials or workstation-specific TLS paths.

`.nevo/local/state/` is reserved for application-owned data such as Session bindings,
transcript/read-model caches, workflow operation records, human-verification records, provider
aliases, and bounded diagnostics. Users should not treat that state as editable configuration.

## Definitions are not flattened into config.yaml

Large declarative definitions keep their own committed files. Agent definitions already live under
`.nevo/agents/`; deterministic workflow definitions will live under `.nevo/workflows/` when
that capability is migrated. Aggregate config may select/default such definitions, but should not
absorb their full bodies.

## Initialization

`nevo-specflow init` owns repository bootstrap only:

- discover the Git repository root;
- create `.nevo/config.yaml` and `.nevo/local/config.yaml`;
- ensure `.nevo/local/` is ignored and verify the concrete local config path with Git;
- compose and serialize capability-owned contributions;
- write local config first and committed config last as the success marker, rolling back on failure.

The product shell resolves the Git repository root for both `init` and `start`, then passes
absolute config paths and the project root into Runtime. Runtime does not discover product file
locations from `process.cwd()`.

Runtime setup first decides whether authentication is required. Required authentication can combine
username/password with one or more named OIDC instances; at least one login method must remain
enabled. Password setup hashes secrets inside Runtime, while every OIDC client secret stays local.

For a new password user, the username is also the canonical user id; the wizard does not ask for a
second technical identifier. Additional password accounts explicitly choose `New user` or
`Existing user`. OIDC identities are configured by allowed email; the normalized email becomes
their stable configured identity automatically, while human-facing profile data comes from verified
OIDC claims at sign-in rather than from init prompts.

A role is selected immediately whenever setup creates a new user. The first-created user defaults to
`admin`; subsequent users default to `developer`. Setup preserves creation order explicitly and
cannot finish without at least one administrator. Trusted local mode keeps its local identity without
showing a login screen.

Before the product shell asks to write files, Runtime contributes a human-readable review of its
non-secret choices: authentication mode and methods, named OIDC instances and ids, issuer/client id,
identity-to-user mappings, canonical users, and role assignments. Passwords, hashes, client secrets,
and other workstation-local secrets are never included in that review.
