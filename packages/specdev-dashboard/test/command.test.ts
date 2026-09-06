import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { createDashboardCommand } from '../src/cli/command.js';
import { DASHBOARD_BOOTSTRAP_MARKER } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('createDashboardCommand — the dashboard CLI adapter', () => {
  it('returns a Commander command named "dashboard"', () => {
    const cmd = createDashboardCommand({ stdout: () => undefined });
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('dashboard');
    expect(cmd.description()).toMatch(/dashboard/i);
  });

  it('its action runs the capability and writes the marker to the injected sink', async () => {
    const out: string[] = [];
    const cmd = createDashboardCommand({ stdout: (l) => out.push(l) });
    cmd.exitOverride();
    await cmd.parseAsync(['node', 'dashboard']);
    expect(out).toEqual([DASHBOARD_BOOTSTRAP_MARKER]);
  });

  it('the capability module (./index) does NOT import Commander — only the ./cli adapter does', () => {
    const core = readFileSync(join(here, '..', 'src', 'index.ts'), 'utf8');
    expect(core).not.toMatch(/['"]commander['"]/);
    const adapter = readFileSync(join(here, '..', 'src', 'cli', 'command.ts'), 'utf8');
    expect(adapter).toMatch(/from 'commander'/);
  });
});
