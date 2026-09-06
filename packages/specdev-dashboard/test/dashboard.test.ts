import { describe, expect, it } from 'vitest';

import { DASHBOARD_BOOTSTRAP_MARKER, runDashboard } from '../src/index.js';

describe('runDashboard — bootstrap capability', () => {
  it('returns the deterministic bootstrap marker', () => {
    expect(runDashboard()).toEqual({ kind: 'bootstrap', message: DASHBOARD_BOOTSTRAP_MARKER });
  });

  it('is pure — repeated calls give an equal result', () => {
    expect(runDashboard()).toEqual(runDashboard());
  });

  it('the marker is a stable, human-readable sentence', () => {
    expect(DASHBOARD_BOOTSTRAP_MARKER).toBe('Nevo SpecDev dashboard command is available.');
  });
});
