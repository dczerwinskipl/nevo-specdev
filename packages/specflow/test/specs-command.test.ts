import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  bootstrapProjectHome,
  discoverSpecifications,
  workspaceRegistryPath,
  updateWorkspaceRegistry,
} from '@nevo/specflow-engine/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { createProgram } from '../src/program';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function fixture(gitEnabled = false) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-cli-create-Ż ')));
  roots.push(root);
  git(root, 'init', '-q');
  await mkdir(join(root, '.nevo'));
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(
    join(root, '.nevo/config.yaml'),
    'runtime: {}\ngit:\n  enabled: ' + String(gitEnabled) + '\n',
  );
  git(root, 'add', '.gitignore', '.nevo/config.yaml');
  git(
    root,
    '-c',
    'user.name=SpecFlow Test',
    '-c',
    'user.email=specflow@example.invalid',
    'commit',
    '-qm',
    'initial',
  );
  return { root, engine: await bootstrapProjectHome(root) };
}

function command(cwd: string) {
  const output: string[] = [];
  const program = createProgram({
    cwd,
    stdout: (line) => output.push(line),
    stderr: () => undefined,
  });
  const run = (args: string[]) => program.parseAsync(['node', 'nevo-specflow', 'specs', ...args]);
  return { run, output };
}

describe('E2.T05 — offline CLI Specs capability', () => {
  it('C01: creates, lists and resolves a canonical Specification with Runtime stopped', async () => {
    const { root, engine } = await fixture();
    const cli = command(root);
    const operationId = randomUUID();
    await cli.run([
      'create',
      '--title',
      'CLI-created canonical Spec',
      '--operation-id',
      operationId,
      '--json',
    ]);
    const result = JSON.parse(cli.output[0]!) as {
      operationId: string;
      specId: string;
      slug: string;
      workspaceId: string;
      relativeManifestPath: string;
    };
    expect(result).toMatchObject({
      operationId,
      workspaceId: engine.workspace.workspaceId,
      slug: 'cli-created-canonical-spec',
    });
    expect(await readFile(join(root, result.relativeManifestPath), 'utf8')).toContain(
      result.specId,
    );

    const otherProcess = command(root);
    await otherProcess.run(['list', '--json']);
    const specs = JSON.parse(otherProcess.output[0]!) as { specId: string }[];
    expect(specs.map((item) => item.specId)).toEqual([result.specId]);

    const resolved = command(root);
    await resolved.run(['resolve', result.specId, '--json']);
    expect(JSON.parse(resolved.output[0]!)).toMatchObject({
      status: 'available',
      specId: result.specId,
      workspaceId: result.workspaceId,
    });

    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const retry = command(root);
    await retry.run([
      'create',
      '--title',
      'CLI-created canonical Spec',
      '--operation-id',
      operationId,
      '--json',
    ]);
    expect(JSON.parse(retry.output[0]!)).toEqual(result);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
    expect(await discoverSpecifications(engine)).toHaveLength(1);
  });

  it('CLI chooses current linked checkout, not Project Home, when no target is specified', async () => {
    const { root, engine } = await fixture();
    const linked = await realpath(await mkdtemp(join(tmpdir(), 'specflow-cli-linked-Ż ')));
    roots.push(linked);
    git(root, 'worktree', 'add', '-q', '-b', 'cli-linked', linked);
    const { provisionLinkedWorkspaceIdentity, addWorkspace, openSpecFlowEngine } =
      await import('@nevo/specflow-engine/testing');
    const registration = await provisionLinkedWorkspaceIdentity(
      engine.context,
      linked,
      randomUUID(),
      false,
    );
    await updateWorkspaceRegistry(engine.context, (registry) =>
      addWorkspace(registry, registration),
    );
    const cli = command(linked);
    await cli.run(['create', '--title', 'Linked target', '--json']);
    const result = JSON.parse(cli.output[0]!) as {
      workspaceId: string;
      relativeManifestPath: string;
    };
    expect(result.workspaceId).toBe(registration.workspaceId);
    expect((await openSpecFlowEngine({ cwd: linked })).workspace.workspaceId).toBe(
      registration.workspaceId,
    );
    expect(await readFile(join(linked, result.relativeManifestPath), 'utf8')).toContain(
      'Linked target',
    );
  });

  it('rejects Git disabled before writing a journal or changing registry', async () => {
    const { root, engine } = await fixture(false);
    const before = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const cli = command(root);
    await expect(cli.run(['create', '--title', 'Not allowed', '--worktree'])).rejects.toMatchObject(
      {
        code: 'GIT_DISABLED',
      },
    );
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(before);
    expect(await discoverSpecifications(engine)).toEqual([]);
  });

  it('requires explicit --worktree for Git options without reserving a Spec', async () => {
    const { root, engine } = await fixture(true);
    const cli = command(root);
    await expect(
      cli.run(['create', '--title', 'No branch', '--branch', 'spec/bad']),
    ).rejects.toThrow('--base-ref and --branch require --worktree');
    expect(await discoverSpecifications(engine)).toEqual([]);
  });
});
