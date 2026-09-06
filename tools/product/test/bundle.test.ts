// bundleProduct is the one place esbuild is used. Prove it: (1) injects the
// version via `--define`, (2) writes a node-executable ESM file with the
// shebang banner, (3) produces a self-contained file (a fixture importing a
// sibling module resolves without leaving anything to require at runtime).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bundleProduct } from '../src/bundle.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nevo-bundle-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('bundleProduct', () => {
  it('injects NEVO_SPEC_VERSION_INJECTED and emits a runnable ESM file with a shebang', async () => {
    writeFileSync(join(dir, 'sibling.ts'), 'export const marker = () => "sibling-ok";\n');
    writeFileSync(
      join(dir, 'entry.ts'),
      [
        'import { marker } from "./sibling.js";',
        'declare const NEVO_SPEC_VERSION_INJECTED: string;',
        'process.stdout.write(`${NEVO_SPEC_VERSION_INJECTED} ${marker()}`);',
        '',
      ].join('\n'),
    );

    const { outfile } = await bundleProduct({
      entry: 'entry.ts',
      outfile: 'out/bundle.js',
      version: '9.9.9-test.1',
      cwd: dir,
    });

    expect(readFileSync(outfile, 'utf8').split('\n')[0]).toBe('#!/usr/bin/env node');
    const stdout = execFileSync('node', [outfile], { encoding: 'utf8' });
    // version was baked in, and the sibling module was bundled (not left as an import).
    expect(stdout).toBe('9.9.9-test.1 sibling-ok');
  });
});
