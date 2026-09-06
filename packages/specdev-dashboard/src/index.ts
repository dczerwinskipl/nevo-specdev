// The Nevo SpecDev dashboard capability.
//
// BOOTSTRAP ONLY. This proves the packaging / CLI-routing boundary:
//
//   installed nevo-spec  ->  CLI routing  ->  THIS package  ->  capability runs
//
// It deliberately does NOT start an HTTP server, load React/Vite, or migrate any
// of the existing Nevo dashboard implementation. It is framework-independent —
// it knows nothing about Commander, argv, stdout, or exit codes. The CLI owns
// all of that; this package owns the capability and returns a plain typed value.

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
 * without changing this signature or the CLI boundary.
 */
export function runDashboard(): DashboardResult {
  return { kind: 'bootstrap', message: DASHBOARD_BOOTSTRAP_MARKER };
}
