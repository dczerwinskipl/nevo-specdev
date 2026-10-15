import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bootstrapProjectHome } from '../src/testing';
import { writeJsonAtomically } from '../src/project/atomic-json';
import { projectControlLockPath, withProjectControlLock } from '../src/project/control-lock';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function project() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-platform-Ż space ')));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await mkdir(join(root, '.nevo'));
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\ngit:\n  enabled: false\n');
  execFileSync('git', ['add', '.gitignore', '.nevo/config.yaml'], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=SpecFlow Test',
      '-c',
      'user.email=specflow@example.invalid',
      'commit',
      '-qm',
      'initial',
    ],
    { cwd: root },
  );
  return bootstrapProjectHome(root);
}

/** Real second OS process, using only Node's native fs API (not another Vitest runner). */
function child(script: string, path: string): string {
  return execFileSync(process.execPath, ['-e', script, path], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  }).trim();
}

const readFromOtherProcess =
  "process.stdout.write(require('node:fs').readFileSync(process.argv[1], 'utf8'))";

const tryExclusiveCreate = `
  const fs = require('node:fs');
  const path = process.argv[1];
  try {
    const fd = fs.openSync(path, 'wx');
    fs.closeSync(fd);
    fs.unlinkSync(path);
    process.stdout.write('acquired');
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
    process.stdout.write('busy');
  }
`;

describe('OS filesystem contracts (real Git checkout and separate Node processes)', () => {
  it('publishes complete atomic snapshots without exposing staged state to another process', async () => {
    const engine = await project();
    const dir = join(engine.context.project.stateRoot, 'engine', 'operations', 'create');
    await mkdir(dir, { recursive: true });
    const path = join(dir, randomUUID() + '.json');
    const before = { version: 1, state: 'before', revision: 1 };
    const after = { version: 1, state: 'after', revision: 2 };

    await withProjectControlLock(engine.context, async () => {
      await writeJsonAtomically(path, before);
      expect(JSON.parse(child(readFromOtherProcess, path))).toEqual(before);

      await writeJsonAtomically(path, after, {
        beforePublish: async () => {
          // The new temp file has been synced, but a second process must still
          // observe the complete previous snapshot until the atomic rename.
          expect(JSON.parse(child(readFromOtherProcess, path))).toEqual(before);
          expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toHaveLength(1);
        },
      });
      expect(JSON.parse(child(readFromOtherProcess, path))).toEqual(after);
      expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(after);
  });

  it('enforces project control lock exclusion across OS processes and releases ownership', async () => {
    const engine = await project();
    const lockPath = projectControlLockPath(engine.context);

    await withProjectControlLock(engine.context, () => {
      // The foreign process cannot exclusively create a lock already owned by
      // the Engine, even on Windows where contention can surface as EPERM.
      expect(child(tryExclusiveCreate, lockPath)).toBe('busy');
      return Promise.resolve();
    });

    // Normal release makes the lock available to an independent process.
    expect(child(tryExclusiveCreate, lockPath)).toBe('acquired');
  });
});
