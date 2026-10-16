import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { createJournalPath } from '../src/specs/create-journal';
import { createGitTestProject, git } from './support/git-project';

import { afterEach, describe, expect, it } from 'vitest';

import {
  bootstrapProjectHome,
  createSpecificationForTesting as createSpecification,
  discoverSpecifications,
  inspectCreateSpecification,
  openSpecFlowEngine,
  workspaceRegistryPath,
  type CreateSpecificationInput,
  type SpecFlowEngine,
} from '../src/testing';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function project(enabled = true): Promise<{ root: string; engine: SpecFlowEngine }> {
  const root = await createGitTestProject(
    'specflow-create-Ż space ',
    'runtime: {}\ngit:\n  enabled: ' + String(enabled) + '\n',
  );
  roots.push(root);
  return { root, engine: await bootstrapProjectHome(root) };
}

function existing(engine: SpecFlowEngine, title = 'Create durable spec'): CreateSpecificationInput {
  return {
    operationId: randomUUID(),
    title,
    created: '2026-10-14',
    target: { kind: 'existing', workspaceId: engine.workspace.workspaceId },
  };
}

function linked(title = 'Create linked spec'): CreateSpecificationInput {
  return {
    operationId: randomUUID(),
    title,
    created: '2026-10-14',
    target: { kind: 'new-worktree', baseRef: 'HEAD' },
  };
}

describe('E2.T04 — durable Spec creation on actual Git', () => {
  it('accepts an unchanged journal CAS snapshot with reordered object keys', async () => {
    const { engine } = await project(false);
    const input = existing(engine, 'Reordered durable journal');
    const created = await createSpecification(engine, input, {
      afterEffect: async (effect) => {
        if (effect !== 'reservation') return;
        const path = createJournalPath(engine.context, input.operationId);
        const journal = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
        await writeFile(
          path,
          JSON.stringify(Object.fromEntries(Object.entries(journal).reverse())),
        );
      },
    });
    expect(created.specId).toBeDefined();
    expect((await inspectCreateSpecification(engine, input.operationId))?.stage).toBe('completed');
  }, 90000);

  it('creates a Spec in primary and retries the same operation without new records', async () => {
    const { root, engine } = await project(false);
    const input = existing(engine);
    const originalRevision = (await engine.readRegistry()).revision;
    const first = await createSpecification(engine, input);
    expect(first.workspaceRoot).toBe(root);
    expect((await inspectCreateSpecification(engine, input.operationId))?.stage).toBe('completed');
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const repeated = await createSpecification(engine, input);
    expect(repeated).toEqual(first);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
    expect((await engine.readRegistry()).revision).toBe(originalRevision + 1);
    expect(await discoverSpecifications(engine)).toMatchObject([
      { status: 'available', specId: first.specId, workspaceId: first.workspaceId },
    ]);
    expect((await readFile(join(root, first.relativeManifestPath), 'utf8')).length).toBeGreaterThan(
      0,
    );
    await expect(
      createSpecification(engine, { ...input, title: 'Unrelated retry' }),
    ).rejects.toMatchObject({ code: 'CREATE_CONFLICT' });
  }, 90000);

  it('creates a linked Git worktree while preserving primary HEAD and project root', async () => {
    const { root, engine } = await project();
    const headBefore = git(root, 'rev-parse', 'HEAD');
    const input = linked();
    const output = await createSpecification(engine, input);
    roots.push(dirname(output.workspaceRoot));
    expect(output.workspaceRoot).not.toBe(root);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(headBefore);
    expect(git(output.workspaceRoot, 'rev-parse', 'HEAD')).toBe(headBefore);
    expect((await engine.readRegistry()).workspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workspaceId: output.workspaceId,
          kind: 'linked',
          managed: true,
        }),
      ]),
    );
    expect(await discoverSpecifications(engine)).toMatchObject([
      { status: 'available', specId: output.specId, workspaceId: output.workspaceId },
    ]);
    const restarted = await openSpecFlowEngine({ cwd: root });
    expect(await createSpecification(restarted, input)).toEqual(output);
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(2);
  }, 90000);

  it('C06: two managed worktrees retain isolated uncommitted Specs without touching primary', async () => {
    const { root, engine } = await project();
    const originalHead = git(root, 'rev-parse', 'HEAD');
    const originalStatus = git(root, 'status', '--porcelain', '--untracked-files=all');

    const first = await createSpecification(engine, linked('First isolated worktree'));
    const second = await createSpecification(engine, linked('Second isolated worktree'));
    for (const parent of [dirname(first.workspaceRoot), dirname(second.workspaceRoot)]) {
      if (!roots.includes(parent)) roots.push(parent);
    }

    expect(first.specId).not.toBe(second.specId);
    expect(first.workspaceId).not.toBe(second.workspaceId);
    expect(first.workspaceRoot).not.toBe(second.workspaceRoot);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(originalHead);
    expect(git(root, 'status', '--porcelain', '--untracked-files=all')).toBe(originalStatus);
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(3);

    const firstManifestPath = join(first.workspaceRoot, first.relativeManifestPath);
    const secondManifestPath = join(second.workspaceRoot, second.relativeManifestPath);
    const firstManifest = await readFile(firstManifestPath, 'utf8');
    const secondManifest = await readFile(secondManifestPath, 'utf8');
    expect(firstManifest).toContain(first.specId);
    expect(secondManifest).toContain(second.specId);
    await expect(readFile(join(second.workspaceRoot, first.relativeManifestPath), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(first.workspaceRoot, second.relativeManifestPath), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });

    const changedFirst = firstManifest.replace('status: draft', 'status: approved');
    expect(changedFirst).not.toBe(firstManifest);
    await writeFile(firstManifestPath, changedFirst);
    expect(await readFile(firstManifestPath, 'utf8')).toBe(changedFirst);
    expect(await readFile(secondManifestPath, 'utf8')).toBe(secondManifest);
    expect(git(root, 'status', '--porcelain', '--untracked-files=all')).toBe(originalStatus);
    expect((await engine.readRegistry()).specBindings).toMatchObject([
      { specId: first.specId, workspaceId: first.workspaceId },
      { specId: second.specId, workspaceId: second.workspaceId },
    ]);
    const discovered = await discoverSpecifications(engine);
    expect(discovered).toHaveLength(2);
    expect(discovered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'available',
          specId: first.specId,
          workspaceId: first.workspaceId,
        }),
        expect.objectContaining({
          status: 'available',
          specId: second.specId,
          workspaceId: second.workspaceId,
        }),
      ]),
    );
  }, 120000);

  it('SC00: records only Engine-created dirty scaffold files with durable fingerprints', async () => {
    const { root, engine } = await project(false);
    const result = await createSpecification(engine, existing(engine, 'Baseline evidence'));
    const journal = await inspectCreateSpecification(engine, result.operationId);
    expect(journal?.stage).toBe('completed');
    expect(journal?.files).toHaveLength(2);
    for (const file of journal!.files) {
      expect(file.relativePath).toMatch(/^specs\/active\/baseline-evidence\//u);
      expect(file.sha256).toBe(
        createHash('sha256')
          .update(await readFile(join(root, file.relativePath), 'utf8'), 'utf8')
          .digest('hex'),
      );
    }
    const sourceStatus = git(root, 'status', '--porcelain', '--untracked-files=all');
    expect(sourceStatus).toContain(result.relativeManifestPath);

    const unknownPath = 'unrelated-user-edit.txt';
    await writeFile(join(root, unknownPath), 'unrelated work\n');
    expect((await inspectCreateSpecification(engine, result.operationId))?.files)
      .toEqual(journal?.files);
    expect(journal?.files.some((file) => file.relativePath === unknownPath)).toBe(false);
    expect(git(root, 'status', '--porcelain', '--untracked-files=all')).toContain(unknownPath);
  }, 90000);

  it('VC05: retries pinned Git reservation after branchPattern/baseRef change', async () => {
    const { root, engine } = await project();
    const input = linked('Pinned Git reservation');
    const originalHead = git(root, 'rev-parse', 'HEAD');

    await expect(
      createSpecification(engine, input, {
        afterEffect: (effect) =>
          effect === 'reservation'
            ? Promise.reject(new Error('Stop after durable reservation'))
            : Promise.resolve(),
      }),
    ).rejects.toThrow('Stop after durable reservation');

    const journal = await inspectCreateSpecification(engine, input.operationId);
    if (journal?.target.kind !== 'new-worktree') throw new Error('Expected linked reservation.');
    expect(journal.version).toBe(2);
    expect(journal?.stage).toBe('reserved');
    expect(journal?.target.branch).toBe(
      'spec/pinned-git-reservation-' + journal.specId.slice(0, 8),
    );
    expect(journal?.target.baseCommit).toBe(originalHead);
    const configPath = join(root, '.nevo/config.yaml');
    await writeFile(
      configPath,
      'runtime: {}\ngit:\n  enabled: true\n  worktrees:\n    branchPattern: "feature/{slug}-{shortId}"\n    baseRef: "refs/heads/not-created"\n',
    );

    const restarted = await openSpecFlowEngine({ cwd: root });
    const created = await createSpecification(restarted, input, {
      resumeInterruptedOperation: true,
    });
    roots.push(dirname(created.workspaceRoot));
    expect(created.specId).toBe(journal?.specId);
    expect(git(created.workspaceRoot, 'rev-parse', 'HEAD')).toBe(originalHead);
    expect(git(created.workspaceRoot, 'symbolic-ref', '--short', 'HEAD')).toBe(
      journal?.target.branch,
    );
    expect((await inspectCreateSpecification(restarted, input.operationId))?.version).toBe(2);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(originalHead);
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(2);
  }, 90000);

  it('VC05: rejects a tampered reserved target even when it is a direct managed child', async () => {
    const { root, engine } = await project();
    const input = linked('Original managed destination');

    await expect(
      createSpecification(engine, input, {
        afterEffect: (effect) =>
          effect === 'reservation'
            ? Promise.reject(new Error('Stop after journal reservation'))
            : Promise.resolve(),
      }),
    ).rejects.toThrow('Stop after journal reservation');

    const original = await inspectCreateSpecification(engine, input.operationId);
    expect(original?.version).toBe(2);
    expect(original?.stage).toBe('reserved');
    expect(original?.target.kind).toBe('new-worktree');
    if (original?.target.kind !== 'new-worktree') {
      throw new Error('Expected a real, durable worktree reservation.');
    }

    const originalTarget = original.target.workspaceRoot;
    const substitutedTarget = join(dirname(originalTarget), 'other-location');
    expect(substitutedTarget).not.toBe(originalTarget);
    const path = createJournalPath(engine.context, input.operationId);
    const tampered = {
      ...original,
      target: { ...original.target, workspaceRoot: substitutedTarget },
    };
    await writeFile(path, JSON.stringify(tampered) + '\n');
    const journalBefore = await readFile(path, 'utf8');
    const refsBefore = git(root, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads');
    const worktreesBefore = git(root, 'worktree', 'list', '--porcelain');
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');

    const restarted = await openSpecFlowEngine({ cwd: root });
    await expect(
      createSpecification(restarted, input, { resumeInterruptedOperation: true }),
    ).rejects.toMatchObject({
      code: 'CREATE_RECOVERY_REQUIRED',
    });

    expect(await readFile(path, 'utf8')).toBe(journalBefore);
    expect((await inspectCreateSpecification(restarted, input.operationId))?.stage).toBe(
      'reserved',
    );
    await expect(lstat(substitutedTarget)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(lstat(originalTarget)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(git(root, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads')).toBe(
      refsBefore,
    );
    expect(git(root, 'worktree', 'list', '--porcelain')).toBe(worktreesBefore);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
  }, 90000);

  it('VC04: disabled policy blocks new Git mutation before git-initiated but allows completed replay', async () => {
    const { root, engine } = await project();
    const input = linked('Disable prior to Git mutation');
    await expect(
      createSpecification(engine, input, {
        afterEffect: (effect) =>
          effect === 'reservation'
            ? Promise.reject(new Error('Stop after reservation'))
            : Promise.resolve(),
      }),
    ).rejects.toThrow('Stop after reservation');

    const configPath = join(root, '.nevo/config.yaml');
    await writeFile(configPath, 'runtime: {}\ngit:\n  enabled: false\n');
    await expect(
      createSpecification(engine, input, { resumeInterruptedOperation: true }),
    ).rejects.toMatchObject({
      code: 'GIT_DISABLED',
    });
    expect((await inspectCreateSpecification(engine, input.operationId))?.stage).toBe('reserved');
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(1);

    await writeFile(configPath, 'runtime: {}\ngit:\n  enabled: true\n');
    const created = await createSpecification(engine, input, {
      resumeInterruptedOperation: true,
    });
    roots.push(dirname(created.workspaceRoot));
    await writeFile(configPath, 'runtime: {}\ngit:\n  enabled: false\n');
    const restarted = await openSpecFlowEngine({ cwd: root });
    expect(await createSpecification(restarted, input)).toEqual(created);
    expect((await inspectCreateSpecification(restarted, input.operationId))?.stage).toBe(
      'completed',
    );
  }, 90000);

  it('VC05: omission means pinned policy defaults; explicit HEAD is distinct intent', async () => {
    const { root, engine } = await project();
    const config = join(root, '.nevo/config.yaml');
    const head = git(root, 'rev-parse', 'HEAD');
    git(root, 'branch', 'develop');
    await writeFile(
      config,
      [
        'runtime: {}',
        'git:',
        '  enabled: true',
        '  worktrees:',
        '    branchPattern: "feature/{slug}-{shortId}"',
        '    baseRef: develop',
        '',
      ].join('\n'),
    );
    const { createSpecificationFromRequest } = await import('../src/index');
    const operationId = randomUUID();
    const request = {
      operationId,
      title: 'Policy picked once',
      target: { kind: 'new-worktree' as const },
    };
    const first = await createSpecificationFromRequest(engine, request);
    roots.push(dirname(first.workspaceRoot));
    const reserved = await inspectCreateSpecification(engine, operationId);
    if (reserved?.target.kind !== 'new-worktree') throw new Error('Expected linked reservation.');
    expect(reserved.version).toBe(2);
    expect(reserved.target.branch).toBe(
      'feature/policy-picked-once-' + reserved.specId.slice(0, 8),
    );
    expect(reserved?.target.baseCommit).toBe(head);
    await writeFile(config, 'runtime: {}\ngit:\n  enabled: false\n');
    expect(await createSpecificationFromRequest(engine, request)).toEqual(first);
    await expect(
      createSpecificationFromRequest(engine, {
        ...request,
        target: { kind: 'new-worktree', baseRef: 'HEAD' },
      }),
    ).rejects.toMatchObject({ code: 'CREATE_CONFLICT' });
  }, 120000);

  it('VC05: reserved omitted defaults survive config changes', async () => {
    const { root, engine } = await project();
    const config = join(root, '.nevo/config.yaml');
    const head = git(root, 'rev-parse', 'HEAD');
    git(root, 'branch', 'develop');
    await writeFile(
      config,
      [
        'runtime: {}',
        'git:',
        '  enabled: true',
        '  worktrees:',
        '    branchPattern: "feature/{slug}-{shortId}"',
        '    baseRef: develop',
        '',
      ].join('\n'),
    );
    const operationId = randomUUID();
    const request = {
      operationId,
      title: 'Omitted defaults pinned',
      target: { kind: 'new-worktree' as const },
    };
    const { createSpecificationWithIntent } = await import('../src/specs/durable-create');
    const { normalizeCreateClientIntent } = await import('../src/specs/create-intent');
    await expect(
      createSpecificationWithIntent(
        engine,
        operationId,
        normalizeCreateClientIntent(request),
        () => '2026-10-14',
        {},
        (effect) =>
          effect === 'reservation'
            ? Promise.reject(new Error('Stop after frozen v2 reservation'))
            : Promise.resolve(),
      ),
    ).rejects.toThrow('Stop after frozen v2 reservation');

    const reserved = await inspectCreateSpecification(engine, operationId);
    if (reserved?.target.kind !== 'new-worktree') throw new Error('Expected linked reservation.');
    expect(reserved.version).toBe(2);
    expect(reserved.stage).toBe('reserved');
    expect(reserved.created).toBe('2026-10-14');
    expect(reserved?.target.branch).toBe(
      'feature/omitted-defaults-pinned-' + reserved.specId.slice(0, 8),
    );
    expect(reserved?.target.baseCommit).toBe(head);

    const resumeReserved = () =>
      createSpecificationWithIntent(
        engine,
        operationId,
        normalizeCreateClientIntent(request),
        () => '2026-10-15',
        { resumeInterruptedOperation: true },
      );
    await writeFile(config, 'runtime: {}\ngit:\n  enabled: false\n');
    await expect(resumeReserved()).rejects.toMatchObject({ code: 'GIT_DISABLED' });
    expect((await inspectCreateSpecification(engine, operationId))?.stage).toBe('reserved');
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(1);

    await writeFile(
      config,
      'runtime: {}\ngit:\n  enabled: true\n  worktrees:\n    branchPattern: "replacement/{slug}-{shortId}"\n    baseRef: refs/heads/not-created\n',
    );
    const result = await resumeReserved();
    roots.push(dirname(result.workspaceRoot));
    expect(result.specId).toBe(reserved?.specId);
    expect(git(result.workspaceRoot, 'symbolic-ref', '--short', 'HEAD')).toBe(
      reserved?.target.branch,
    );
    expect(git(result.workspaceRoot, 'rev-parse', 'HEAD')).toBe(head);
    expect((await inspectCreateSpecification(engine, operationId))?.version).toBe(2);
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(2);
  }, 120000);

  it('retries completed linked create after a normal commit without side effects', async () => {
    const { root, engine } = await project();
    const input = linked('Committed linked specification');
    const first = await createSpecification(engine, input);
    roots.push(dirname(first.workspaceRoot));

    const checkout = first.workspaceRoot;
    const branchBefore = git(checkout, 'symbolic-ref', 'HEAD');
    const baseHead = git(checkout, 'rev-parse', 'HEAD');
    const manifestPath = join(checkout, first.relativeManifestPath);
    const originalManifest = await readFile(manifestPath, 'utf8');
    expect(originalManifest).toContain('status: draft');
    await writeFile(manifestPath, originalManifest.replace('status: draft', 'status: approved'));
    git(checkout, 'add', '--', first.relativeManifestPath);
    git(
      checkout,
      '-c',
      'user.name=SpecFlow Test',
      '-c',
      'user.email=specflow@example.invalid',
      'commit',
      '-qm',
      'normal specification update',
    );
    const advancedHead = git(checkout, 'rev-parse', 'HEAD');
    expect(advancedHead).not.toBe(baseHead);

    const committedManifest = await readFile(manifestPath, 'utf8');
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const worktreesBefore = git(root, 'worktree', 'list', '--porcelain');
    const refsBefore = git(root, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads');
    const journalBefore = await inspectCreateSpecification(engine, input.operationId);

    const restarted = await openSpecFlowEngine({ cwd: root });
    const retried = await createSpecification(restarted, input);
    expect(retried).toEqual(first);
    expect((await inspectCreateSpecification(restarted, input.operationId))?.stage).toBe(
      'completed',
    );
    expect(await inspectCreateSpecification(restarted, input.operationId)).toEqual(journalBefore);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(advancedHead);
    expect(git(checkout, 'symbolic-ref', 'HEAD')).toBe(branchBefore);
    expect(git(root, 'worktree', 'list', '--porcelain')).toBe(worktreesBefore);
    expect(git(root, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads')).toBe(
      refsBefore,
    );
    expect(await readFile(manifestPath, 'utf8')).toBe(committedManifest);
    expect(committedManifest).toContain('status: approved');
  }, 90000);

  it('does not replay a Git command after an interruption without explicit quiescence', async () => {
    const { root, engine } = await project();
    const input = linked('Interrupted Git');

    await expect(
      createSpecification(engine, input, {
        afterEffect: (effect) =>
          effect === 'git'
            ? Promise.reject(new Error('Injected crash after Git effect'))
            : Promise.resolve(),
      }),
    ).rejects.toThrow('Injected crash');
    const journal = await inspectCreateSpecification(engine, input.operationId);
    expect(journal?.stage).toBe('git-initiated');
    const workspace = journal!.target.workspaceRoot;
    roots.push(dirname(workspace));
    await expect(
      createSpecification(engine, input, { resumeInterruptedOperation: true }),
    ).rejects.toMatchObject({ code: 'CREATE_RECOVERY_REQUIRED' });
    const recovered = await createSpecification(engine, input, {
      resumeInterruptedOperation: true,
      confirmInterruptedGitSettled: true,
    });
    expect(recovered.workspaceRoot).toBe(workspace);
    expect(git(root, 'worktree', 'list', '--porcelain').match(/worktree /gu)).toHaveLength(2);
    expect((await inspectCreateSpecification(engine, input.operationId))?.stage).toBe('completed');
  }, 90000);

  it('replays manifest-written effects without duplicating files or registry bindings', async () => {
    const { root, engine } = await project(false);
    const input = existing(engine, 'Restart after manifest');
    await expect(
      createSpecification(engine, input, {
        afterEffect: (effect) =>
          effect === 'manifest'
            ? Promise.reject(new Error('Injected crash after scaffold'))
            : Promise.resolve(),
      }),
    ).rejects.toThrow('Injected crash');
    expect((await inspectCreateSpecification(engine, input.operationId))?.stage).toBe(
      'manifest-writing',
    );
    const output = await createSpecification(engine, input, {
      resumeInterruptedOperation: true,
    });
    expect(await discoverSpecifications(engine)).toHaveLength(1);
    expect((await engine.readRegistry()).specBindings).toHaveLength(1);
    expect(await readFile(join(root, output.relativeManifestPath), 'utf8')).toContain(
      output.specId,
    );
  }, 90000);

  it('recovers after registry CAS publication without a second registry mutation', async () => {
    const { engine } = await project(false);
    const input = existing(engine, 'Restart after registry');
    await expect(
      createSpecification(engine, input, {
        afterEffect: (effect) =>
          effect === 'registry'
            ? Promise.reject(new Error('Injected crash after registry'))
            : Promise.resolve(),
      }),
    ).rejects.toThrow('Injected crash');
    expect((await inspectCreateSpecification(engine, input.operationId))?.stage).toBe(
      'registry-writing',
    );
    const previous = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const output = await createSpecification(engine, input, {
      resumeInterruptedOperation: true,
    });
    expect(output.specId).toBe((await engine.readRegistry()).specBindings[0]?.specId);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(previous);
  }, 90000);

  it('rejects a tampered scaffold on retry instead of overwriting unrelated edits', async () => {
    const { root, engine } = await project(false);
    const input = existing(engine, 'Tampered manifest');
    await expect(
      createSpecification(engine, input, {
        afterEffect: (effect) =>
          effect === 'manifest'
            ? Promise.reject(new Error('Injected crash after scaffold'))
            : Promise.resolve(),
      }),
    ).rejects.toThrow('Injected crash');
    const journal = (await inspectCreateSpecification(engine, input.operationId))!;
    const path = join(root, journal.files[0]!.relativePath);
    await writeFile(path, 'malicious: different\n');
    await expect(
      createSpecification(engine, input, { resumeInterruptedOperation: true }),
    ).rejects.toMatchObject({ code: 'CREATE_RECOVERY_REQUIRED' });
    expect(await readFile(path, 'utf8')).toBe('malicious: different\n');
  }, 90000);

  it('rejects disabled Git automation before any journal, branch or registry write', async () => {
    const { root, engine } = await project(false);
    const input = linked('Disabled Git');
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const branchesBefore = git(root, 'branch', '--list');
    await expect(createSpecification(engine, input)).rejects.toMatchObject({
      code: 'GIT_DISABLED',
    });
    expect(await inspectCreateSpecification(engine, input.operationId)).toBeUndefined();
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
    expect(git(root, 'branch', '--list')).toBe(branchesBefore);
  }, 90000);

  it('rejects an invalid base config blob before journal and Git side effects', async () => {
    const { root, engine } = await project();
    await writeFile(join(root, '.nevo/config.yaml'), 'runtime: false\ngit:\n  enabled: true\n');
    git(root, 'add', '.nevo/config.yaml');
    git(
      root,
      '-c',
      'user.name=SpecFlow Test',
      '-c',
      'user.email=specflow@example.invalid',
      'commit',
      '-qm',
      'invalid config',
    );
    await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\ngit:\n  enabled: true\n');
    const input = linked('Invalid base');
    await expect(createSpecification(engine, input)).rejects.toMatchObject({
      code: 'GIT_BASE_CONFIG_MISSING',
    });
    expect(await inspectCreateSpecification(engine, input.operationId)).toBeUndefined();
  }, 90000);

  it('serializes same-slug create attempts without losing committed registry state', async () => {
    const { engine } = await project(false);
    const [a, b] = await Promise.allSettled([
      createSpecification(engine, existing(engine, 'Competing slug')),
      createSpecification(engine, existing(engine, 'Competing slug')),
    ]);
    expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);
    const rejected: unknown =
      a.status === 'rejected' ? a.reason : b.status === 'rejected' ? b.reason : undefined;
    expect(rejected).toMatchObject({ code: 'CREATE_CONFLICT' });
    expect((await engine.readRegistry()).specBindings).toHaveLength(1);
  }, 90000);

  it('persists distinct concurrent creations without losing registry updates', async () => {
    const { engine } = await project(false);
    const a = existing(engine, 'First parallel');
    const b = existing(engine, 'Second parallel');
    const results = await Promise.all([
      createSpecification(engine, a),
      createSpecification(engine, b),
    ]);
    expect(new Set(results.map((item) => item.specId)).size).toBe(2);
    expect((await engine.readRegistry()).specBindings).toHaveLength(2);
    expect(await discoverSpecifications(engine)).toHaveLength(2);
  }, 90000);
});
