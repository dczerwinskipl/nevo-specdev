// Cheap, in-process tests of the `nevo-spec` router. The real packed-and-
// installed process boundary is covered separately by packaging.smoke.test.ts.

import { CommanderError } from 'commander';
import { describe, expect, it } from 'vitest';

import { DASHBOARD_BOOTSTRAP_MARKER } from '@nevo/specdev-dashboard';

import { createProgram } from '../src/program.js';
import { NEVO_SPEC_VERSION } from '../src/version.js';

function harness() {
  const out: string[] = [];
  const err: string[] = [];
  const program = createProgram({ stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
  const run = (args: string[]) => program.parseAsync(['node', 'nevo-spec', ...args]);
  return { run, out, err };
}

describe('createProgram — nevo-spec router', () => {
  it('--help lists the CLI name and the dashboard command, exits 0', async () => {
    const { run, out } = harness();
    await expect(run(['--help'])).rejects.toMatchObject({ code: 'commander.helpDisplayed' });
    const text = out.join('\n');
    expect(text).toContain('nevo-spec');
    expect(text).toContain('dashboard');
  });

  it('--version prints the injected version constant', async () => {
    const { run, out } = harness();
    await expect(run(['--version'])).rejects.toMatchObject({ code: 'commander.version' });
    expect(out.join('\n')).toContain(NEVO_SPEC_VERSION);
  });

  it('dashboard routes into the sibling capability and prints its marker', async () => {
    const { run, out } = harness();
    await run(['dashboard']);
    expect(out).toEqual([DASHBOARD_BOOTSTRAP_MARKER]);
  });

  it('an unknown command is a usage error (CommanderError, not a crash)', async () => {
    const { run } = harness();
    await expect(run(['not-a-command'])).rejects.toBeInstanceOf(CommanderError);
  });

  it('no command shows help rather than doing nothing', async () => {
    const { run } = harness();
    await expect(run([])).rejects.toBeInstanceOf(CommanderError);
  });
});
