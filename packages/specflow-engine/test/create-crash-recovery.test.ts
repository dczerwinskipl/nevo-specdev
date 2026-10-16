import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  bootstrapProjectHome,
  createSpecification,
  inspectCreateSpecification,
  openSpecFlowEngine,
  inspectProjectControlLock,
  projectControlLockPath,
  workspaceRegistryPath,
  updateWorkspaceRegistry,
  addWorkspace,
  bindSpecToWorkspace,
  provisionLinkedWorkspaceIdentity,
  createSpecificationScaffold,
  type CreateSpecificationInput,
  type SpecFlowEngine,
} from '../src/testing';
import { withProjectControlLock } from '../src/project/control-lock';
import {
  CREATE_JOURNAL_RELATIVE_DIR,
  createJournalPath,
  withCreateJournalLock,
  type CreateJournalV2,
} from '../src/specs/create-journal';
import {
  fingerprintCreateClientIntent,
  normalizeCreateClientIntent,
} from '../src/specs/create-intent';
import { createLegacySpecificationScaffold } from '../src/specs/model';
import { createGitTestProject, git } from './support/git-project';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function project(gitEnabled = false): Promise<{ root: string; engine: SpecFlowEngine }> {
  const root = await createGitTestProject(
    'specflow-crash-Ż space ',
    'runtime: {}\ngit:\n  enabled: ' + String(gitEnabled) + '\n',
  );
  roots.push(root);
  if (gitEnabled) roots.push(root + '-worktrees');
  return { root, engine: await bootstrapProjectHome(root) };
}

function request(engine: SpecFlowEngine, title: string, linked = false): CreateSpecificationInput {
  return {
    operationId: randomUUID(),
    title,
    created: '2026-10-14',
    target: linked
      ? { kind: 'new-worktree', baseRef: 'HEAD' }
      : { kind: 'existing', workspaceId: engine.workspace.workspaceId },
  };
}

type Mode = 'crash' | 'resume' | 'atomic-write';
interface Worker {
  readonly signal: string;
  readonly done: Promise<{ readonly code: number | null; readonly output: string }>;
  kill(): boolean;
}

function worker(
  root: string,
  input: CreateSpecificationInput,
  mode: Mode,
  options: { stage?: string; expectError?: string; gitSettled?: boolean } = {},
): Worker {
  const signal = join(root, 'worker-' + randomUUID() + '.checkpoint');
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
      'test/fixtures/crash-create-worker.test.ts',
      '--maxWorkers=1',
      '--testTimeout=60000',
    ],
    {
      cwd: packageRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NEVO_CREATE_CRASH_WORKER: '1',
        NEVO_CREATE_CRASH_HOME: root,
        NEVO_CREATE_CRASH_INPUT: JSON.stringify(input),
        NEVO_CREATE_CRASH_MODE: mode,
        NEVO_CREATE_CRASH_STAGE: options.stage ?? '',
        NEVO_CREATE_CRASH_SIGNAL: signal,
        NEVO_CREATE_CRASH_GIT_SETTLED: options.gitSettled ? '1' : '0',
        NEVO_CREATE_CRASH_EXPECT_ERROR: options.expectError ?? '',
      },
    },
  );
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    output += chunk;
  });
  const done = new Promise<{ code: number | null; output: string }>((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolvePromise({ code, output }));
  });
  return { signal, done, kill: () => child.kill('SIGKILL') };
}

async function awaitSignal(path: string): Promise<void> {
  const deadline = Date.now() + 45000;
  while (true) {
    try {
      await access(path);
      return;
    } catch {
      if (Date.now() > deadline) throw new Error('Crash child did not reach durable checkpoint.');
      await sleep(30);
    }
  }
}

async function killAtCheckpoint(
  root: string,
  input: CreateSpecificationInput,
  stage: string,
  mode: Mode = 'crash',
): Promise<string> {
  const child = worker(root, input, mode, { stage });
  await awaitSignal(child.signal);
  const checkpoint = JSON.parse(await readFile(child.signal, 'utf8')) as {
    stage: string;
    pid: number;
  };
  // Kill the OS process executing the actual mutation (a Vitest worker may
  // be a different PID from the test runner that launched it).
  expect(checkpoint.pid).toBeGreaterThan(0);
  process.kill(checkpoint.pid, 'SIGKILL');
  const outcome = await Promise.race([
    child.done,
    sleep(15000).then(() => {
      child.kill();
      throw new Error('Killed worker process did not terminate its supervising runner.');
    }),
  ]);
  expect(outcome.code, outcome.output).not.toBe(0);
  return checkpoint.stage;
}

async function replay(
  root: string,
  input: CreateSpecificationInput,
  options: { expectError?: string; gitSettled?: boolean } = {},
): Promise<string> {
  const child = worker(root, input, 'resume', options);
  const outcome = await child.done;
  expect(outcome.code, outcome.output).toBe(0);
  return readFile(child.signal, 'utf8');
}

describe('E2.T04 — actual process termination and fresh-process recovery', () => {
  it('R01: SIGKILL after durable reservation resumes the original spec without duplicates', async () => {
    const { root, engine } = await project();
    const input = request(engine, 'Reservation killed');
    expect(await killAtCheckpoint(root, input, 'reservation')).toBe('reservation');
    const before = (await inspectCreateSpecification(engine, input.operationId))!;
    expect(before.stage).toBe('reserved');
    expect((await engine.readRegistry()).specBindings).toHaveLength(0);
    const result = JSON.parse(await replay(root, input)) as { specId: string; operationId: string };
    expect(result.specId).toBe(before.specId);
    expect(result.operationId).toBe(input.operationId);
    expect((await engine.readRegistry()).specBindings).toHaveLength(1);
    expect((await inspectCreateSpecification(engine, input.operationId))?.stage).toBe('completed');
  }, 120000);

  it('T09: SIGKILL during historical v2 Create replay preserves exact old manifest bytes', async () => {
    const { root, engine } = await project();
    const input = request(engine, 'Historical process crash');
    if (input.target.kind !== 'existing') throw new Error('Expected primary target.');
    const specId = randomUUID();
    const scaffold = createLegacySpecificationScaffold({
      specId,
      title: input.title,
      created: input.created,
    });
    const clientIntent = normalizeCreateClientIntent(input);
    const record: CreateJournalV2 = {
      version: 2,
      projectId: engine.context.project.projectId,
      operationId: input.operationId,
      inputFingerprint: fingerprintCreateClientIntent(clientIntent),
      specId,
      slug: scaffold.slug,
      title: input.title,
      created: input.created,
      stage: 'reserved',
      target: {
        kind: 'existing',
        workspaceId: engine.workspace.workspaceId,
        workspaceRoot: root,
      },
      files: scaffold.files.map(({ relativePath, sha256 }) => ({ relativePath, sha256 })),
      requestIntent: clientIntent,
    };
    await withCreateJournalLock(engine.context, async () => {
      await writeFile(
        createJournalPath(engine.context, input.operationId),
        JSON.stringify(record) + '\n',
      );
    });

    expect(await killAtCheckpoint(root, input, 'manifest')).toBe('manifest');
    const afterCrash = (await inspectCreateSpecification(engine, input.operationId))!;
    expect(afterCrash.stage).toBe('manifest-writing');
    expect(afterCrash.specId).toBe(specId);
    expect(afterCrash.files).toEqual(record.files);
    const manifest = join(root, scaffold.files[0]!.relativePath);
    const originalBytes = await readFile(manifest, 'utf8');
    expect(originalBytes).toBe(scaffold.files[0]!.content);

    const resumed = JSON.parse(await replay(root, input)) as {
      specId: string;
      relativeManifestPath: string;
    };
    expect(resumed.specId).toBe(specId);
    expect(resumed.relativeManifestPath).toBe(scaffold.files[0]!.relativePath);
    expect(await readFile(manifest, 'utf8')).toBe(originalBytes);
    expect((await inspectCreateSpecification(engine, input.operationId))?.stage).toBe('completed');
    expect(
      (await engine.readRegistry()).specBindings.filter((x) => x.specId === specId),
    ).toHaveLength(1);
  }, 120000);

  it('R02: SIGKILL after git worktree add fences automatic replay until externally settled', async () => {
    const { root, engine } = await project(true);
    const input = request(engine, 'Git process killed', true);
    expect(await killAtCheckpoint(root, input, 'git')).toBe('git');
    const recorded = (await inspectCreateSpecification(engine, input.operationId))!;
    expect(recorded.stage).toBe('git-initiated');
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(2);
    expect(await replay(root, input, { expectError: 'CREATE_RECOVERY_REQUIRED' })).toBe(
      'expected:CREATE_RECOVERY_REQUIRED',
    );
    const output = JSON.parse(await replay(root, input, { gitSettled: true })) as {
      specId: string;
    };
    expect(output.specId).toBe(recorded.specId);
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(2);
    expect((await engine.readRegistry()).specBindings).toHaveLength(1);
  }, 150000);

  it('R03: SIGKILL after manifest write resumes and links the exact original manifest', async () => {
    const { root, engine } = await project();
    const input = request(engine, 'Manifest killed');
    expect(await killAtCheckpoint(root, input, 'manifest')).toBe('manifest');
    const saved = (await inspectCreateSpecification(engine, input.operationId))!;
    expect(saved.stage).toBe('manifest-writing');
    const manifest = join(root, saved.files[0]!.relativePath);
    const contents = await readFile(manifest, 'utf8');
    const output = JSON.parse(await replay(root, input)) as { specId: string };
    expect(output.specId).toBe(saved.specId);
    expect(await readFile(manifest, 'utf8')).toBe(contents);
    expect((await engine.readRegistry()).specBindings).toHaveLength(1);
  }, 120000);

  it('R04: SIGKILL after registry commit repeats response, not the registry mutation', async () => {
    const { root, engine } = await project();
    const input = request(engine, 'Registry killed');
    expect(await killAtCheckpoint(root, input, 'registry')).toBe('registry');
    const saved = (await inspectCreateSpecification(engine, input.operationId))!;
    expect(saved.stage).toBe('registry-writing');
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const output = JSON.parse(await replay(root, input)) as { specId: string };
    expect(output.specId).toBe(saved.specId);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
  }, 120000);

  it('R05: external changes after SIGKILL produce conflict without overwrite or cleanup', async () => {
    const { root, engine } = await project();
    const input = request(engine, 'Externally modified');
    await killAtCheckpoint(root, input, 'manifest');
    const saved = (await inspectCreateSpecification(engine, input.operationId))!;
    const path = join(root, saved.files[0]!.relativePath);
    await writeFile(path, 'external: edited\n');
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    expect(await replay(root, input, { expectError: 'CREATE_RECOVERY_REQUIRED' })).toBe(
      'expected:CREATE_RECOVERY_REQUIRED',
    );
    expect(await readFile(path, 'utf8')).toBe('external: edited\n');
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
  }, 120000);

  it('SIGKILL during atomic journal publication retains orphan lock and staged temp; no silent cleanup', async () => {
    const { root, engine } = await project();
    const input = request(engine, 'Crash inside atomic rename');
    expect(await killAtCheckpoint(root, input, 'atomic', 'atomic-write')).toBe('staged');
    expect((await inspectProjectControlLock(engine.context)).status).toBe('held');
    const dir = join(engine.context.project.stateRoot, CREATE_JOURNAL_RELATIVE_DIR);
    const temps = (await readdir(dir)).filter((name) => name.endsWith('.tmp'));
    expect(temps).toHaveLength(1);
    // A dead PID does not authorize automatic lock stealing.
    await expect(
      withProjectControlLock(engine.context, () => Promise.resolve(), { waitMs: 0 }),
    ).rejects.toMatchObject({ code: 'CONTROL_LOCK_BUSY' });
    // Explicit operator recovery in this test ONLY: process is known dead, so
    // inspect/preserve the staged journal, release its verified orphan lock,
    // then move the abandoned .tmp out of the authoritative journal directory.
    await rm(projectControlLockPath(engine.context));
    const initial = await openSpecFlowEngine({ cwd: root });
    await expect(createSpecification(initial, input)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual(temps);
    await rm(join(dir, temps[0]!));
    const output = JSON.parse(await replay(root, input)) as { specId: string };
    expect(output.specId).toMatch(/^[0-9a-f-]{36}$/u);
    expect((await engine.readRegistry()).specBindings).toHaveLength(1);
  }, 120000);

  it('unavailable unrelated bound Spec blocks create intentionally until global slug ownership is provable', async () => {
    const { root, engine } = await project();
    const linkedRoot = await realpath(await mkdtemp(join(tmpdir(), 'specflow-missing-source-')));
    roots.push(linkedRoot);
    git(root, 'worktree', 'add', '-q', '-b', 'spec/unavailable', linkedRoot);
    const workspaceId = randomUUID();
    const linked = await provisionLinkedWorkspaceIdentity(
      engine.context,
      linkedRoot,
      workspaceId,
      false,
    );
    const existingId = randomUUID();
    const scaffold = createSpecificationScaffold({
      specId: existingId,
      title: 'Missing source',
      created: '2026-10-14',
    });
    for (const file of scaffold.files) {
      const absolute = join(linkedRoot, file.relativePath);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, file.content);
    }
    await updateWorkspaceRegistry(engine.context, (registry) =>
      bindSpecToWorkspace(addWorkspace(registry, linked), existingId, linked.workspaceId),
    );
    await rm(linkedRoot, { recursive: true, force: true });
    const input = request(engine, 'Completely different title');
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    await expect(createSpecification(engine, input)).rejects.toMatchObject({
      code: 'CREATE_RECOVERY_REQUIRED',
    });
    expect(await inspectCreateSpecification(engine, input.operationId)).toBeUndefined();
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
  }, 120000);
});
