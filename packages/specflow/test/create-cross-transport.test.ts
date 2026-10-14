import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  bootstrapProjectHome,
  discoverSpecifications,
  openSpecFlowEngine,
  workspaceRegistryPath,
} from '@nevo/specflow-engine';
import { startRuntime } from '@nevo/specflow-runtime';
import { afterEach, describe, expect, it } from 'vitest';

import { createProgram } from '../src/program';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test TCP port missing.');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function fixture(gitEnabled: boolean, port: number) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-http-cli-Ż space ')));
  roots.push(root);
  git(root, 'init', '-q');
  await mkdir(join(root, '.nevo'));
  const config = [
    'runtime:',
    '  server:',
    '    host: 127.0.0.1',
    '    port: ' + port,
    '    tls:',
    '      enabled: false',
    '  authentication:',
    '    mode: none',
    '    providers:',
    '      password:',
    '        enabled: false',
    '      oidc:',
    '        instances: {}',
    'git:',
    '  enabled: ' + String(gitEnabled),
    '',
  ].join('\n');
  await writeFile(join(root, '.nevo/config.yaml'), config);
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  git(root, 'add', '.nevo/config.yaml', '.gitignore');
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
  return { root, engine: await bootstrapProjectHome(root) };
}

function cli(cwd: string) {
  const lines: string[] = [];
  const program = createProgram({
    cwd,
    stdout: (line) => lines.push(line),
    stderr: () => undefined,
  });
  const run = (args: string[]) => program.parseAsync(['node', 'nevo-specflow', 'specs', ...args]);
  return { run, lines };
}

interface Created {
  readonly specId: string;
  readonly slug: string;
  readonly workspaceId: string;
  readonly workspaceRoot: string;
  readonly relativeManifestPath: string;
  readonly operationId: string;
}

describe('E2.T05 — real HTTP and offline CLI share one Engine authority', () => {
  it('H02: HTTP creates while Runtime is running; offline CLI resolves after shutdown', async () => {
    const port = await freePort();
    const { root, engine } = await fixture(false, port);
    const runtime = await startRuntime({
      projectRoot: root,
      projectConfigPath: join(root, '.nevo/config.yaml'),
      localConfigPath: join(root, '.nevo/local/config.yaml'),
      dependencies: { specs: { engine } },
    });

    const operationId = randomUUID();
    let created: Created;
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/api/specs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Cross transport canonical Spec', operationId }),
      });
      expect(response.status).toBe(201);
      created = (await response.json()) as Created;
      expect(created.operationId).toBe(operationId);
      expect(created.workspaceId).toBe(engine.workspace.workspaceId);
    } finally {
      await runtime.close();
    }

    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const offline = cli(root);
    await offline.run(['resolve', created.specId, '--json']);
    expect(JSON.parse(offline.lines[0]!)).toMatchObject({
      specId: created.specId,
      status: 'available',
      workspaceId: created.workspaceId,
      specification: { title: 'Cross transport canonical Spec' },
    });
    expect(await readFile(join(root, created.relativeManifestPath), 'utf8')).toContain(
      created.specId,
    );

    const retry = cli(root);
    await retry.run([
      'create',
      '--title',
      'Cross transport canonical Spec',
      '--operation-id',
      operationId,
      '--json',
    ]);
    expect(JSON.parse(retry.lines[0]!)).toEqual(created);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
    expect((await discoverSpecifications(engine)).map((item) => item.specId)).toEqual([
      created.specId,
    ]);
  }, 60000);

  it('C02: offline CLI creates an optional linked Git worktree and resolves its canonical Spec', async () => {
    const { root, engine } = await fixture(true, await freePort());
    const before = git(root, 'rev-parse', 'HEAD');
    const shell = cli(root);
    await shell.run(['create', '--title', 'CLI linked checkout', '--worktree', '--json']);

    const created = JSON.parse(shell.lines[0]!) as Created;
    roots.push(dirname(created.workspaceRoot));
    expect(created.workspaceRoot).not.toBe(root);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(before);
    expect(git(created.workspaceRoot, 'rev-parse', 'HEAD')).toBe(before);
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(2);

    const linkedEngine = await openSpecFlowEngine({ cwd: created.workspaceRoot });
    expect(linkedEngine.context.project.homeRoot).toBe(root);
    expect(linkedEngine.workspace.workspaceId).toBe(created.workspaceId);

    const fromLinked = cli(created.workspaceRoot);
    await fromLinked.run(['resolve', created.specId, '--json']);
    expect(JSON.parse(fromLinked.lines[0]!)).toMatchObject({
      status: 'available',
      specId: created.specId,
      workspaceId: created.workspaceId,
      workspaceRoot: created.workspaceRoot,
    });
    expect((await engine.readRegistry()).specBindings).toHaveLength(1);
  }, 60000);
});
