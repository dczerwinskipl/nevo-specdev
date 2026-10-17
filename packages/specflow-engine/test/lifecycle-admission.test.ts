import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  bootstrapProjectHome,
  createSpecificationForTesting,
  inspectCloseOperation,
  listCloseJournals,
  previewCloseOperation,
  reserveCloseOperation,
  type SpecFlowEngine,
} from '../src/testing';
import { createGitTestProject, git } from './support/git-project';
import { closeJournalPath } from '../src/specs/lifecycle/journal-store';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture(target: 'current' | 'different' | 'none' = 'current') {
  const root = await createGitTestProject(
    'specflow-lifecycle-Ż space ',
    'runtime: {}\ngit:\n  enabled: true\n',
  );
  roots.push(root);
  const branch = git(root, 'symbolic-ref', '--short', 'HEAD');
  await writeFile(
    join(root, '.nevo/config.yaml'),
    'runtime: {}\ngit:\n  enabled: true\n' +
      (target === 'none'
        ? ''
        : '  integrationTargetBranch: ' + (target === 'current' ? branch : 'other-branch') + '\n'),
  );
  git(root, 'add', '.nevo/config.yaml');
  git(
    root,
    '-c', 'user.name=SpecFlow Test',
    '-c', 'user.email=specflow@example.invalid',
    'commit', '-qm', 'project branch policy',
  );
  return { root, engine: await bootstrapProjectHome(root), branch };
}

async function specification(engine: SpecFlowEngine, title: string, linked = false) {
  const created = await createSpecificationForTesting(engine, {
    operationId: randomUUID(),
    title,
    created: '2026-10-17',
    target: linked
      ? { kind: 'new-worktree', baseRef: 'HEAD' }
      : { kind: 'existing', workspaceId: engine.workspace.workspaceId },
  });
  if (linked) roots.push(dirname(created.workspaceRoot));
  git(created.workspaceRoot, 'add', '--', created.relativeManifestPath, 'specs/active/' + created.slug + '/overview.md');
  git(
    created.workspaceRoot,
    '-c', 'user.name=SpecFlow Test',
    '-c', 'user.email=specflow@example.invalid',
    'commit', '-qm', 'commit authored source',
  );
  return created;
}

describe('E2.T10 — read-only lifecycle admission and durable shared Git resource claims', () => {
  it('previews primary close without changing Git/index/registry or worktrees', async () => {
    const { engine, root, branch } = await fixture();
    const created = await specification(engine, 'Archive on primary');
    const gitHead = git(root, 'rev-parse', 'HEAD');
    const registryBefore = await engine.readRegistry();
    const preview = await previewCloseOperation(engine, {
      kind: 'specification-close',
      operationId: randomUUID(),
      specId: created.specId,
    });

    expect(preview).toMatchObject({
      kind: 'specification-close',
      specId: created.specId,
      location: 'active',
      registryRevision: registryBefore.revision,
      source: { workspaceId: engine.workspace.workspaceId, branch, head: gitHead },
      target: { workspaceId: engine.workspace.workspaceId, branch, head: gitHead },
      targetBranch: branch,
    });
    expect(preview.resources).toContain('checkout:' + engine.workspace.workspaceId);
    expect(preview.resources).toContain('ref:refs/heads/' + branch.toLowerCase());
    expect(git(root, 'rev-parse', 'HEAD')).toBe(gitHead);
    expect(git(root, 'status', '--porcelain', '--untracked-files=all')).toBe('');
    expect(await engine.readRegistry()).toEqual(registryBefore);
    expect(await listCloseJournals(engine.context)).toEqual([]);
  }, 90000);

  it('reserves the primary index across different Spec IDs and preserves retry ownership', async () => {
    const { engine, root } = await fixture();
    const first = await specification(engine, 'First closable');
    const second = await specification(engine, 'Second closable');
    const operationId = randomUUID();
    const request = { kind: 'specification-close' as const, specId: first.specId, operationId };
    const head = git(root, 'rev-parse', 'HEAD');
    const before = await engine.readRegistry();
    const claimed = await reserveCloseOperation(engine, request);

    expect(claimed.existing).toBe(false);
    expect(claimed.journal.stage).toBe('reserved');
    expect((await inspectCloseOperation(engine, operationId))?.plan).toEqual(claimed.journal.plan);
    expect(await reserveCloseOperation(engine, request)).toEqual({
      journal: claimed.journal,
      existing: true,
    });
    await expect(
      reserveCloseOperation(engine, {
        kind: 'specification-close',
        operationId: randomUUID(),
        specId: second.specId,
      }),
    ).rejects.toMatchObject({ code: 'CLOSE_CONFLICT' });

    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(await engine.readRegistry()).toEqual(before);
    expect(await listCloseJournals(engine.context)).toHaveLength(1);

    // An identical retry remains a reader once first-admission clean-tree
    // preflight is no longer possible; it must not re-publish or own effects.
    await writeFile(join(root, first.relativeManifestPath), 'external edit\n');
    expect((await reserveCloseOperation(engine, request)).existing).toBe(true);
    await expect(
      reserveCloseOperation(engine, { ...request, specId: second.specId }),
    ).rejects.toMatchObject({ code: 'CLOSE_CONFLICT' });
  }, 90000);

  it('blocks Close after an unfinished Create reserves the same primary checkout', async () => {
    const { engine } = await fixture();
    const created = await specification(engine, 'Closable before pending create');
    await expect(
      createSpecificationForTesting(
        engine,
        {
          operationId: randomUUID(),
          title: 'Pending Create in same checkout',
          created: '2026-10-17',
          target: { kind: 'existing', workspaceId: engine.workspace.workspaceId },
        },
        {
          afterEffect: async (stage) => {
            if (stage === 'reservation') throw new Error('intentionally interrupted Create');
          },
        },
      ),
    ).rejects.toThrow('intentionally interrupted Create');

    await expect(
      reserveCloseOperation(engine, {
        kind: 'specification-close',
        operationId: randomUUID(),
        specId: created.specId,
      }),
    ).rejects.toMatchObject({ code: 'CLOSE_CONFLICT' });
    expect(await listCloseJournals(engine.context)).toEqual([]);
  }, 90000);

  it('allows linked archive-only without target configuration or primary branch mutation', async () => {
    const { engine, root } = await fixture('none');
    const first = await specification(engine, 'Local archive first', true);
    const second = await specification(engine, 'Local archive second', true);
    const homeHead = git(root, 'rev-parse', 'HEAD');
    const one = await reserveCloseOperation(engine, {
      kind: 'specification-close',
      operationId: randomUUID(),
      specId: first.specId,
      integrateToTargetBranch: false,
    });
    const two = await reserveCloseOperation(engine, {
      kind: 'specification-close',
      operationId: randomUUID(),
      specId: second.specId,
      integrateToTargetBranch: false,
    });

    expect(one.existing).toBe(false);
    expect(two.existing).toBe(false);
    expect(one.journal.plan.targetBranch).toBeUndefined();
    expect(one.journal.plan.target).toBeUndefined();
    expect(one.journal.plan.integrateToTargetBranch).toBe(false);
    expect(two.journal.plan.source.workspaceId).not.toBe(one.journal.plan.source.workspaceId);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(homeHead);
    await expect(
      previewCloseOperation(engine, {
        kind: 'worktree-close',
        operationId: randomUUID(),
        specId: second.specId,
      }),
    ).rejects.toMatchObject({ code: 'CLOSE_PREFLIGHT' });
  }, 120000);

  it('blocks wrong primary branch, uncommitted content and primary Worktree close', async () => {
    const { engine: wrong } = await fixture('different');
    const wrongSpec = await specification(wrong, 'Wrong configured branch');
    await expect(
      previewCloseOperation(wrong, {
        kind: 'specification-close',
        specId: wrongSpec.specId,
      }),
    ).rejects.toMatchObject({ code: 'CLOSE_PREFLIGHT' });
    const { engine: current, root } = await fixture();
    const spec = await specification(current, 'Dirty worktree');
    await writeFile(join(root, 'do-not-touch.txt'), 'untouched\n');
    await expect(
      previewCloseOperation(current, {
        kind: 'specification-close',
        specId: spec.specId,
      }),
    ).rejects.toMatchObject({ code: 'CLOSE_PREFLIGHT' });
    expect(await readFile(join(root, 'do-not-touch.txt'), 'utf8')).toBe('untouched\n');
    await expect(
      previewCloseOperation(current, { kind: 'worktree-close', specId: spec.specId }),
    ).rejects.toMatchObject({ code: 'CLOSE_PREFLIGHT' });
  }, 120000);

  it('rejects tampered or redirected journal resources and never overwrites them', async () => {
    const { engine } = await fixture();
    const created = await specification(engine, 'Immutable claims');
    const operationId = randomUUID();
    await reserveCloseOperation(engine, {
      kind: 'specification-close',
      specId: created.specId,
      operationId,
    });
    const path = closeJournalPath(engine.context, operationId);
    const original = JSON.parse(await readFile(path, 'utf8')) as {
      plan: { resources: string[] };
    };
    const corrupted = {
      ...original,
      plan: { ...original.plan, resources: ['spec:' + created.specId] },
    };
    await writeFile(path, JSON.stringify(corrupted));
    await expect(inspectCloseOperation(engine, operationId)).rejects.toMatchObject({
      code: 'CLOSE_JOURNAL_CORRUPT',
    });
    await expect(listCloseJournals(engine.context)).rejects.toMatchObject({
      code: 'CLOSE_JOURNAL_CORRUPT',
    });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(corrupted);
  }, 90000);
});
