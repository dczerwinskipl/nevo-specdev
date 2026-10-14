import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addWorkspace,
  bindSpecToWorkspace,
  bootstrapProjectHome,
  createSpecificationScaffold,
  discoverSpecifications,
  openSpecFlowEngine,
  provisionLinkedWorkspaceIdentity,
  resolveSpecification,
  workspaceRegistryPath,
  type SpecFlowEngine,
  type SpecificationScaffold,
} from '../src/index';

// Real-Git and checkout-incarnation probes are disk-intensive on Windows,
// especially when concurrent crash/multiprocess suites run in CI.
// Preserve all assertions but use a realistic per-test timeout.
vi.setConfig({ testTimeout: 90_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function project(): Promise<{ root: string; engine: SpecFlowEngine }> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-discovery-Ż space ')));
  roots.push(root);
  git(root, 'init', '-q');
  await mkdir(join(root, '.nevo'), { recursive: true });
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
    'initial',
  );
  return { root, engine: await bootstrapProjectHome(root) };
}

async function linkedWorkspace(engine: SpecFlowEngine, branch = 'spec/discovery') {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-linked-Ż space ')));
  roots.push(root);
  git(engine.context.project.homeRoot, 'worktree', 'add', '-q', '-b', branch, root);
  const registration = await provisionLinkedWorkspaceIdentity(
    engine.context,
    root,
    randomUUID(),
    false,
  );
  await engine.updateRegistry((registry) => addWorkspace(registry, registration));
  return registration;
}

async function persist(root: string, scaffold: SpecificationScaffold): Promise<string> {
  for (const file of scaffold.files) {
    const absolute = join(root, file.relativePath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, file.content, 'utf8');
  }
  return join(root, scaffold.files[0]!.relativePath);
}

function scaffold(specId: string, title: string): SpecificationScaffold {
  return createSpecificationScaffold({ specId, title, created: '2026-10-14' });
}

describe('E2.T03 — canonical Specification binding and discovery (real Git)', () => {
  it('C07: deduplicates primary and bound linked manifests, selecting linked content', async () => {
    const { root, engine } = await project();
    const linked = await linkedWorkspace(engine);
    const specId = randomUUID();
    const source = scaffold(specId, 'Shared specification');
    await persist(root, source);
    const linkedManifestPath = await persist(linked.root, source);
    const linkedContent = await readFile(linkedManifestPath, 'utf8');
    await writeFile(linkedManifestPath, linkedContent.replace('status: draft', 'status: approved'));
    await engine.updateRegistry((registry) =>
      bindSpecToWorkspace(registry, specId, linked.workspaceId),
    );

    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const results = await discoverSpecifications(engine);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      status: 'available',
      specId,
      workspaceId: linked.workspaceId,
      workspaceRoot: linked.root,
      binding: 'explicit',
      specification: { specId, status: 'approved' },
    });
    expect(await resolveSpecification(engine, specId)).toEqual(results[0]);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
  });

  it('C08/P05: preserves unavailable linked binding and refuses primary fallback', async () => {
    const { root, engine } = await project();
    const linked = await linkedWorkspace(engine);
    const specId = randomUUID();
    await persist(root, scaffold(specId, 'Stale primary duplicate'));
    await persist(linked.root, scaffold(specId, 'Authoritative linked'));
    await engine.updateRegistry((registry) =>
      bindSpecToWorkspace(registry, specId, linked.workspaceId),
    );
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    await rm(linked.root, { recursive: true, force: true });

    const expected = {
      status: 'workspace_unavailable',
      specId,
      workspaceId: linked.workspaceId,
      binding: 'explicit',
    };
    expect(await resolveSpecification(engine, specId)).toMatchObject(expected);
    expect(await discoverSpecifications(engine)).toEqual([expect.objectContaining(expected)]);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
  });

  it('distinguishes missing bound manifest from unavailable linked checkout', async () => {
    const { root, engine } = await project();
    const linked = await linkedWorkspace(engine);
    const specId = randomUUID();
    await persist(root, scaffold(specId, 'Primary copy retained'));
    await engine.updateRegistry((registry) =>
      bindSpecToWorkspace(registry, specId, linked.workspaceId),
    );

    expect(await resolveSpecification(engine, specId)).toMatchObject({
      status: 'manifest_missing',
      specId,
      workspaceId: linked.workspaceId,
      workspaceRoot: linked.root,
      binding: 'explicit',
    });
    expect(await discoverSpecifications(engine)).toHaveLength(1);
  });

  it('does not scan registered but unbound linked worktrees as canonical specs', async () => {
    const { root, engine } = await project();
    const linked = await linkedWorkspace(engine);
    const primaryId = randomUUID();
    const unboundId = randomUUID();
    await persist(root, scaffold(primaryId, 'Primary spec'));
    await persist(linked.root, scaffold(primaryId, 'Untrusted alternate'));
    await persist(linked.root, scaffold(unboundId, 'Unbound linked-only'));

    expect(await discoverSpecifications(engine)).toMatchObject([
      {
        status: 'available',
        specId: primaryId,
        workspaceId: engine.workspace.workspaceId,
        binding: 'primary-default',
        specification: { title: 'Primary spec' },
      },
    ]);
    await expect(resolveSpecification(engine, unboundId)).rejects.toMatchObject({
      code: 'SPEC_NOT_FOUND',
    });
  });

  it('rejects and ignores unknown external Git worktrees not present in registry', async () => {
    const { root, engine } = await project();
    const outside = await realpath(await mkdtemp(join(tmpdir(), 'specflow-external-')));
    roots.push(outside);
    git(root, 'worktree', 'add', '-q', '-b', 'spec/external', outside);
    const specId = randomUUID();
    await persist(outside, scaffold(specId, 'External only'));
    expect(await discoverSpecifications(engine)).toEqual([]);
    await expect(resolveSpecification(engine, specId)).rejects.toMatchObject({
      code: 'SPEC_NOT_FOUND',
    });
  });

  it('C09: detects contradictory duplicate bindings without repairing corrupted registry', async () => {
    const { root, engine } = await project();
    const linked = await linkedWorkspace(engine);
    const specId = randomUUID();
    await persist(root, scaffold(specId, 'Original'));
    await engine.updateRegistry((registry) =>
      bindSpecToWorkspace(registry, specId, linked.workspaceId),
    );
    const path = workspaceRegistryPath(engine.context);
    const parsed = JSON.parse(await readFile(path, 'utf8')) as {
      specBindings: { specId: string; workspaceId: string; generation: number }[];
    };
    parsed.specBindings.push({
      specId,
      workspaceId: engine.workspace.workspaceId,
      generation: parsed.specBindings[0]!.generation,
    });
    const corrupted = JSON.stringify(parsed);
    await writeFile(path, corrupted);

    await expect(discoverSpecifications(engine)).rejects.toMatchObject({
      code: 'REGISTRY_CORRUPT',
    });
    expect(await readFile(path, 'utf8')).toBe(corrupted);
  });

  it('rejects two distinct canonical Spec IDs sharing one visible slug', async () => {
    const { root, engine } = await project();
    const linked = await linkedWorkspace(engine);
    const firstId = randomUUID();
    const secondId = randomUUID();
    await persist(root, scaffold(firstId, 'Shared slug'));
    await persist(linked.root, scaffold(secondId, 'Shared slug'));
    await engine.updateRegistry((registry) =>
      bindSpecToWorkspace(registry, secondId, linked.workspaceId),
    );
    await expect(discoverSpecifications(engine)).rejects.toMatchObject({
      code: 'SPEC_CONFLICT',
    });
  });

  it('rejects replaced linked checkout identities rather than treating them as missing', async () => {
    const { engine } = await project();
    const linked = await linkedWorkspace(engine);
    const specId = randomUUID();
    await persist(linked.root, scaffold(specId, 'Protected source'));
    await engine.updateRegistry((registry) =>
      bindSpecToWorkspace(registry, specId, linked.workspaceId),
    );
    await writeFile(join(linked.root, '.nevo/local/state/workspace-identity.json'), '{}\n');
    await expect(discoverSpecifications(engine)).rejects.toMatchObject({
      code: 'REGISTRY_WORKSPACE_MISMATCH',
    });
  });

  it('refreshes manifest edits between reads, without relying on an index or cache', async () => {
    const { root, engine } = await project();
    const specId = randomUUID();
    const path = await persist(root, scaffold(specId, 'Fresh title'));
    expect((await resolveSpecification(engine, specId)).status).toBe('available');
    await writeFile(
      path,
      (await readFile(path, 'utf8')).replace('status: draft', 'status: approved'),
    );
    expect(await resolveSpecification(engine, specId)).toMatchObject({
      status: 'available',
      specification: { status: 'approved' },
    });
  });

  it('works from linked Engine caller while retaining Project Home selection', async () => {
    const { root, engine } = await project();
    const linked = await linkedWorkspace(engine);
    const specId = randomUUID();
    await persist(root, scaffold(specId, 'Canonical primary'));
    const fromLinked = await openSpecFlowEngine({ cwd: linked.root });
    expect(await resolveSpecification(fromLinked, specId)).toMatchObject({
      status: 'available',
      workspaceRoot: root,
      workspaceId: engine.workspace.workspaceId,
    });
  });
});
