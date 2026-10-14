import { randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  bootstrapProjectHome,
  discoverSpecifications,
  workspaceRegistryPath,
  type CreateSpecificationInput,
} from '../src/index';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function project() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-create-process-Ż ')));
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
  return { root, engine: await bootstrapProjectHome(root) };
}

function input(workspaceId: string, title: string): CreateSpecificationInput {
  return {
    operationId: randomUUID(),
    title,
    created: '2026-10-14',
    target: { kind: 'existing', workspaceId },
  };
}

interface ProcessWorker {
  readonly ready: string;
  readonly start: string;
  readonly paused: string;
  readonly release: string;
  readonly observed: string;
  readonly result: string;
  readonly done: Promise<{ readonly code: number | null; readonly log: string }>;
}

function spawnCreateWorker(
  root: string,
  request: CreateSpecificationInput,
  options: {
    readonly pauseEffect?: 'git' | 'manifest';
    readonly observeReservation?: boolean;
  } = {},
): ProcessWorker {
  const token = randomUUID();
  const ready = join(root, 'create-' + token + '.ready');
  const start = join(root, 'create-' + token + '.go');
  const paused = join(root, 'create-' + token + '.paused');
  const release = join(root, 'create-' + token + '.release');
  const observed = join(root, 'create-' + token + '.observed');
  const result = join(root, 'create-' + token + '.result');
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const vitestEntry = resolve(
    dirname(fileURLToPath(import.meta.resolve('vitest'))),
    '..',
    'vitest.mjs',
  );
  const child = spawn(
    process.execPath,
    [
      vitestEntry,
      'run',
      'test/fixtures/create-worker.test.ts',
      '--maxWorkers=1',
      '--testTimeout=120000',
    ],
    {
      cwd: packageRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NEVO_CREATE_WORKER: '1',
        NEVO_CREATE_WORKER_HOME: root,
        NEVO_CREATE_WORKER_READY: ready,
        NEVO_CREATE_WORKER_START: start,
        NEVO_CREATE_WORKER_INPUT: JSON.stringify(request),
        NEVO_CREATE_WORKER_PAUSE_STAGE: options.pauseEffect ?? '',
        NEVO_CREATE_WORKER_PAUSED: paused,
        NEVO_CREATE_WORKER_RELEASE: release,
        NEVO_CREATE_WORKER_OBSERVED: options.observeReservation ? observed : '',
        NEVO_CREATE_WORKER_RESULT: result,
      },
    },
  );
  let log = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    log += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    log += chunk;
  });
  const done = new Promise<{ code: number | null; log: string }>((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolvePromise({ code, log }));
  });
  return { ready, start, paused, release, observed, result, done };
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 30000;
  while (true) {
    try {
      await access(path);
      return;
    } catch {
      if (Date.now() >= deadline) {
        throw new Error('A create worker did not reach its expected barrier: ' + path);
      }
      await sleep(25);
    }
  }
}

async function startTogether(workers: readonly ProcessWorker[]): Promise<void> {
  await Promise.all(workers.map((worker) => waitForFile(worker.ready)));
  await Promise.all(workers.map((worker) => writeFile(worker.start, 'go')));
}

describe('E2.T04 — cross-process durable create reservation and registry CAS', () => {
  it('L01: one winner for conflicting same-slug operations across OS processes', async () => {
    const { engine, root } = await project();
    const workers = [
      spawnCreateWorker(root, input(engine.workspace.workspaceId, 'Same slug')),
      spawnCreateWorker(root, input(engine.workspace.workspaceId, 'Same slug')),
    ];
    await startTogether(workers);
    const outcomes = await Promise.all(workers.map((worker) => worker.done));
    expect(outcomes.map((item) => item.code === 0).sort(), JSON.stringify(outcomes)).toEqual([
      false,
      true,
    ]);
    expect((await engine.readRegistry()).specBindings).toHaveLength(1);
    expect(await discoverSpecifications(engine)).toHaveLength(1);
  }, 150000);

  it('VC05: same operationId across two process clocks has one durable date and binding', async () => {
    const { engine, root } = await project();
    const operationId = randomUUID();
    const one = {
      ...input(engine.workspace.workspaceId, 'Concurrent midnight'),
      operationId,
      created: '2026-10-14',
    };
    const two = { ...one, created: '2026-10-15' };
    const workers = [spawnCreateWorker(root, one), spawnCreateWorker(root, two)];
    await startTogether(workers);
    const outcomes = await Promise.all(workers.map((worker) => worker.done));
    expect(
      outcomes.map((x) => x.code),
      JSON.stringify(outcomes),
    ).toEqual([0, 0]);
    const { readCreateJournal } = await import('../src/specs/create-journal');
    const journal = await readCreateJournal(engine.context, operationId);
    expect(journal?.version).toBe(2);
    expect(['2026-10-14', '2026-10-15']).toContain(journal?.created);
    expect((await engine.readRegistry()).specBindings).toHaveLength(1);
    expect(await discoverSpecifications(engine)).toHaveLength(1);
  }, 180000);

  for (const pausedAt of ['git', 'manifest'] as const) {
    it(
      'VC05: second process joins live ' + pausedAt + ' checkpoint without repeating effects',
      async () => {
        const { engine, root } = await project();
        await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\ngit:\n  enabled: true\n');
        roots.push(join(dirname(root), basename(root) + '-worktrees'));
        const operationId = randomUUID();
        const original = {
          operationId,
          title: 'Concurrent ' + pausedAt + ' join',
          created: '2026-10-14',
          target: { kind: 'new-worktree' as const, baseRef: 'HEAD' },
        };
        const writer = spawnCreateWorker(root, original, { pauseEffect: pausedAt });
        await startTogether([writer]);
        await waitForFile(writer.paused);
        const { readCreateJournal } = await import('../src/specs/create-journal');
        const journal = await readCreateJournal(engine.context, operationId);
        expect(journal?.version).toBe(2);
        expect(journal?.stage).toBe(pausedAt === 'git' ? 'git-initiated' : 'manifest-writing');

        const follower = spawnCreateWorker(
          root,
          { ...original, created: '2026-10-15' },
          { observeReservation: true },
        );
        await startTogether([follower]);
        // This signal is emitted AFTER reserve() has seen the existing journal.
        await waitForFile(follower.observed);
        const before = await readCreateJournal(engine.context, operationId);
        expect(before?.stage).toBe(journal?.stage);
        const resultWhilePaused = await Promise.race([
          follower.done.then(() => 'finished'),
          sleep(400).then(() => 'still-following'),
        ]);
        expect(resultWhilePaused).toBe('still-following');
        expect((await engine.readRegistry()).specBindings).toHaveLength(0);
        expect(
          execFileSync('git', ['worktree', 'list', '--porcelain'], {
            cwd: root,
            encoding: 'utf8',
          }).match(/worktree /gu),
        ).toHaveLength(2);
        expect((await readCreateJournal(engine.context, operationId))?.stage).toBe(journal?.stage);

        await writeFile(writer.release, 'continue');
        const outcomes = await Promise.all([writer.done, follower.done]);
        expect(
          outcomes.map((x) => x.code),
          JSON.stringify(outcomes),
        ).toEqual([0, 0]);
        const [writerResult, followerResult] = await Promise.all([
          readFile(writer.result, 'utf8'),
          readFile(follower.result, 'utf8'),
        ]);
        expect(JSON.parse(followerResult)).toEqual(JSON.parse(writerResult));
        expect((await readCreateJournal(engine.context, operationId))?.stage).toBe('completed');
        expect((await engine.readRegistry()).specBindings).toHaveLength(1);
        expect(await discoverSpecifications(engine)).toHaveLength(1);
        expect(
          execFileSync('git', ['worktree', 'list', '--porcelain'], {
            cwd: root,
            encoding: 'utf8',
          }).match(/worktree /gu),
        ).toHaveLength(2);
      },
      150000,
    );
  }

  it('L02: disjoint OS-process creates both persist without a lost registry update', async () => {
    const { engine, root } = await project();
    const workers = [
      spawnCreateWorker(root, input(engine.workspace.workspaceId, 'First process')),
      spawnCreateWorker(root, input(engine.workspace.workspaceId, 'Second process')),
    ];
    await startTogether(workers);
    const outcomes = await Promise.all(workers.map((worker) => worker.done));
    expect(
      outcomes.map((item) => item.code),
      JSON.stringify(outcomes),
    ).toEqual([0, 0]);
    const registry = await engine.readRegistry();
    expect(registry.specBindings).toHaveLength(2);
    expect(new Set(registry.specBindings.map((item) => item.specId)).size).toBe(2);
    expect(await discoverSpecifications(engine)).toHaveLength(2);
    expect(workspaceRegistryPath(engine.context)).toContain('workspaces.json');
  }, 150000);
});
