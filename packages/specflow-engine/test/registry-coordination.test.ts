import { randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
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
  PROJECT_HOME_MARKER_RELATIVE_PATH,
  addWorkspace,
  bindSpecToWorkspace,
  initializeWorkspaceRegistry,
  inspectProjectControlLock,
  projectControlLockPath,
  readWorkspaceRegistry,
  resolveProjectHome,
  updateWorkspaceRegistry,
  withProjectControlLock,
  workspaceRegistryPath,
} from '../src/index';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-lock-process-Ż ')));
  roots.push(root);
  git(root, 'init', '-q');
  await mkdir(join(root, '.nevo/local/state'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\n');
  git(root, 'add', '.gitignore', '.nevo/config.yaml');
  git(
    root,
    '-c',
    'user.name=SpecFlow Test',
    '-c',
    'user.email=specflow@example.invalid',
    'commit',
    '-qm',
    'bootstrap',
  );
  await writeFile(
    join(root, PROJECT_HOME_MARKER_RELATIVE_PATH),
    JSON.stringify({
      version: 1,
      projectId: randomUUID(),
      homeRoot: root,
      gitCommonDir: await realpath(resolve(root, '.git')),
    }),
  );
  const context = await resolveProjectHome({ cwd: root });
  await initializeWorkspaceRegistry(context);
  return { root, context };
}

async function linked(root: string): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'specflow-linked-Ż ')));
  roots.push(path);
  git(root, 'worktree', 'add', '--detach', path);
  return path;
}

interface WorkerOptions {
  readonly mode: string;
  readonly target: string;
  readonly linked?: string;
  readonly workspaceId?: string;
}

interface Worker {
  readonly ready: string;
  readonly start: string;
  readonly outcome: Promise<{ code: number | null; signal: NodeJS.Signals | null; log: string }>;
}

function startWorker(root: string, options: WorkerOptions): Worker {
  const id = randomUUID();
  const ready = join(root, `worker-${id}.ready`);
  const start = join(root, `worker-${id}.go`);
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const vitestEntry = resolve(
    dirname(fileURLToPath(import.meta.resolve('vitest'))),
    '..',
    'vitest.mjs',
  );
  const child = spawn(
    process.execPath,
    [vitestEntry, 'run', 'test/fixtures/registry-worker.test.ts', '--maxWorkers=1'],
    {
      cwd: packageRoot,
      windowsHide: true,
      env: {
        ...process.env,
        NEVO_REGISTRY_WORKER: '1',
        NEVO_REGISTRY_HOME: root,
        NEVO_REGISTRY_READY: ready,
        NEVO_REGISTRY_GO: start,
        NEVO_REGISTRY_MODE: options.mode,
        NEVO_REGISTRY_TARGET: options.target,
        ...(options.linked ? { NEVO_REGISTRY_LINKED: options.linked } : {}),
        ...(options.workspaceId ? { NEVO_REGISTRY_WORKSPACE_ID: options.workspaceId } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let log = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (s: string) => {
    log += s;
  });
  child.stderr.on('data', (s: string) => {
    log += s;
  });
  const outcome = new Promise<{ code: number | null; signal: NodeJS.Signals | null; log: string }>(
    (resolvePromise, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolvePromise({ code, signal, log }));
    },
  );
  return { ready, start, outcome };
}

async function launchTogether(workers: readonly Worker[]): Promise<void> {
  const deadline = Date.now() + 30000;
  for (const worker of workers) {
    while (true) {
      try {
        await access(worker.ready);
        break;
      } catch {
        if (Date.now() > deadline) throw new Error('Independent worker did not reach barrier.');
        await sleep(25);
      }
    }
  }
  await Promise.all(workers.map((worker) => writeFile(worker.start, 'go')));
}

describe('E1.T05 independent OS-process coordination', () => {
  it('does not lose two simultaneous registry updates', async () => {
    const { root, context } = await fixture();
    const left = randomUUID();
    const right = randomUUID();
    const workers = [
      startWorker(root, { mode: 'bind', target: left }),
      startWorker(root, { mode: 'bind', target: right }),
    ];
    await launchTogether(workers);
    const outcomes = await Promise.all(workers.map((worker) => worker.outcome));
    expect(
      outcomes.map((x) => x.code),
      JSON.stringify(outcomes),
    ).toEqual([0, 0]);

    const registry = await readWorkspaceRegistry(context);
    expect(registry.revision).toBe(2);
    expect(new Set(registry.specBindings.map((b) => b.specId))).toEqual(new Set([left, right]));
    expect(new Set(registry.specBindings.map((b) => b.generation))).toEqual(new Set([1, 2]));
  }, 75000);

  it('serializes registrations of two independently verified linked worktrees', async () => {
    const { root, context } = await fixture();
    const first = await linked(root);
    const second = await linked(root);
    const workers = [
      startWorker(root, { mode: 'register', target: randomUUID(), linked: first }),
      startWorker(root, { mode: 'register', target: randomUUID(), linked: second }),
    ];
    await launchTogether(workers);
    const outcomes = await Promise.all(workers.map((worker) => worker.outcome));
    expect(
      outcomes.map((x) => x.code),
      JSON.stringify(outcomes),
    ).toEqual([0, 0]);

    const registry = await readWorkspaceRegistry(context);
    expect(registry.revision).toBe(2);
    expect(registry.workspaces).toHaveLength(3);
    expect(registry.workspaces.map((w) => w.root)).toContain(first);
    expect(registry.workspaces.map((w) => w.root)).toContain(second);
  }, 75000);

  it('rejects simultaneous conflicting bindings instead of silently rebinding', async () => {
    const { root, context } = await fixture();
    const linkedRoot = await linked(root);
    const linkedId = randomUUID();
    await updateWorkspaceRegistry(context, (current) =>
      addWorkspace(current, {
        workspaceId: linkedId,
        root: linkedRoot,
        kind: 'linked',
        managed: true,
      }),
    );
    const specId = randomUUID();
    const workers = [
      startWorker(root, { mode: 'bind', target: specId }),
      startWorker(root, { mode: 'bind', target: specId, workspaceId: linkedId }),
    ];
    await launchTogether(workers);
    const outcomes = await Promise.all(workers.map((worker) => worker.outcome));
    expect(outcomes.filter((x) => x.code === 0)).toHaveLength(1);
    expect(outcomes.filter((x) => x.code !== 0)).toHaveLength(1);
    const registry = await readWorkspaceRegistry(context);
    expect(registry.revision).toBe(2);
    expect(registry.specBindings.filter((x) => x.specId === specId)).toHaveLength(1);
  }, 75000);

  it('retains the previous valid registry after SIGKILL before atomic rename', async () => {
    const { root, context } = await fixture();
    const previous = await readFile(workspaceRegistryPath(context), 'utf8');
    const worker = startWorker(root, { mode: 'crash-before-rename', target: 'unused' });
    await launchTogether([worker]);
    const outcome = await worker.outcome;
    expect(outcome.code).not.toBe(0);
    expect(await readFile(workspaceRegistryPath(context), 'utf8')).toBe(previous);
    expect((await inspectProjectControlLock(context)).status).toBe('held');
    const files = await readdir(context.project.stateRoot);
    expect(files).toContain('workspaces.json');
    expect(files.some((name) => name.endsWith('.tmp'))).toBe(true);

    await expect(
      updateWorkspaceRegistry(
        context,
        (current) => bindSpecToWorkspace(current, randomUUID(), current.primaryWorkspaceId),
        { lock: { waitMs: 0 } },
      ),
    ).rejects.toMatchObject({ code: 'CONTROL_LOCK_BUSY' });

    // Explicit test-only operator recovery; production must not steal this lock.
    await rm(projectControlLockPath(context));
    await updateWorkspaceRegistry(context, (current) =>
      bindSpecToWorkspace(current, randomUUID(), current.primaryWorkspaceId),
    );
    expect((await readWorkspaceRegistry(context)).revision).toBe(1);
  }, 75000);

  it('retains committed CAS after post-publish SIGKILL', async () => {
    const { root, context } = await fixture();
    const worker = startWorker(root, { mode: 'crash-after-rename', target: 'unused' });
    await launchTogether([worker]);
    const outcome = await worker.outcome;
    expect(outcome.code).not.toBe(0);

    const published = await readWorkspaceRegistry(context);
    expect(published.revision).toBe(1);
    expect((await inspectProjectControlLock(context)).status).toBe('held');
    // Recovery must not infer "free" merely from a dead PID.
    await expect(
      updateWorkspaceRegistry(context, (current) => current, { lock: { waitMs: 0 } }),
    ).rejects.toMatchObject({ code: 'CONTROL_LOCK_BUSY' });

    // After explicit operator recovery, a request with old CAS cannot replay.
    await rm(projectControlLockPath(context));
    await expect(
      updateWorkspaceRegistry(context, (current) => current, { expectedRevision: 0 }),
    ).rejects.toMatchObject({ code: 'REGISTRY_CONFLICT' });
    expect((await readWorkspaceRegistry(context)).revision).toBe(1);
  }, 75000);

  it('rejects an unregistered linked caller even when the Git common-dir matches', async () => {
    const { root } = await fixture();
    const linkedRoot = await linked(root);
    const linkedContext = await resolveProjectHome({ cwd: linkedRoot });
    await expect(
      updateWorkspaceRegistry(linkedContext, (current) => current),
    ).rejects.toMatchObject({ code: 'REGISTRY_CONFLICT' });
  });

  it('does not allow in-place modification to bypass registry transition checks', async () => {
    const { context } = await fixture();
    await expect(
      updateWorkspaceRegistry(context, (current) => {
        (current.workspaces as unknown as { managed: boolean }[])[0]!.managed = true;
        return current;
      }),
    ).rejects.toThrow();
    expect((await readWorkspaceRegistry(context)).workspaces[0]?.managed).toBe(false);
  });

  it('fails closed on a corrupt control lock instead of overwriting it', async () => {
    const { context } = await fixture();
    const path = projectControlLockPath(context);
    await writeFile(path, '{incomplete', 'utf8');
    expect((await inspectProjectControlLock(context)).status).toBe('corrupt');
    await expect(
      withProjectControlLock(context, () => Promise.resolve(undefined), { waitMs: 0 }),
    ).rejects.toMatchObject({ code: 'CONTROL_LOCK_CORRUPT' });
    expect(await readFile(path, 'utf8')).toBe('{incomplete');
  });

  it('preserves absent linked bindings and refuses new bindings to missing roots', async () => {
    const { root, context } = await fixture();
    const linkedRoot = await linked(root);
    const linkedId = randomUUID();
    await updateWorkspaceRegistry(
      context,
      (current) =>
        addWorkspace(current, {
          workspaceId: linkedId,
          kind: 'linked',
          root: linkedRoot,
          managed: true,
        }),
    );
    git(root, 'worktree', 'remove', '--force', linkedRoot);

    await expect(
      updateWorkspaceRegistry(context, (current) =>
        bindSpecToWorkspace(current, 'new-spec', linkedId),
      ),
    ).rejects.toMatchObject({ code: 'REGISTRY_WORKSPACE_UNAVAILABLE' });
    const persisted = await readWorkspaceRegistry(context);
    expect(persisted.revision).toBe(1);
    expect(persisted.workspaces.some((w) => w.workspaceId === linkedId)).toBe(true);
    expect(persisted.specBindings).toEqual([]);
  });

  it('prevents lost updates with an explicit stale CAS revision', async () => {
    const { context } = await fixture();
    await updateWorkspaceRegistry(context, (current) =>
      bindSpecToWorkspace(current, 'first', current.primaryWorkspaceId),
    );
    await expect(
      updateWorkspaceRegistry(
        context,
        (current) => bindSpecToWorkspace(current, 'second', current.primaryWorkspaceId),
        { expectedRevision: 0 },
      ),
    ).rejects.toMatchObject({ code: 'REGISTRY_CONFLICT' });
    expect((await readWorkspaceRegistry(context)).revision).toBe(1);
  });
});
