// The Nevo SpecDev dashboard capability — application / runtime surface.
//
// BOOTSTRAP ONLY. This proves the packaging / CLI-routing boundary:
//
//   installed nevo-spec  ->  shell composition  ->  dashboard CLI adapter
//     ->  THIS capability  ->  a deterministic marker
//
// It deliberately does NOT start an HTTP server, load React/Vite, or migrate any
// of the existing Nevo dashboard implementation. This module is
// framework-independent — it knows nothing about Commander, argv, stdout, or
// exit codes. The `./cli` adapter owns the CLI concerns; this file owns the
// capability and returns a plain typed value.

/** A deterministic marker so callers (and the packaging smoke test) can assert routing worked. */
export const DASHBOARD_BOOTSTRAP_MARKER = 'Nevo SpecDev dashboard command is available.';

export interface DashboardResult {
  /** `bootstrap` until the real dashboard runtime is migrated. */
  readonly kind: 'bootstrap';
  /** Human-facing line the CLI prints verbatim. */
  readonly message: string;
}

/**
 * Run the dashboard capability. For now this only confirms the command is wired
 * end to end; a later change replaces the body with the real dashboard startup
 * without changing this signature, the `./cli` adapter, or the shell boundary.
 */
export function runDashboard(): DashboardResult {
  return { kind: 'bootstrap', message: DASHBOARD_BOOTSTRAP_MARKER };
}
