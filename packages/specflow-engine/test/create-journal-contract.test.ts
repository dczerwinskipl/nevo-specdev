import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  bootstrapProjectHome,
  createSpecification,
  createSpecificationScaffold,
  openSpecFlowEngine,
} from '../src/testing';
import {
  fingerprintCreateClientIntent,
  normalizeCreateClientIntent,
} from '../src/specs/create-intent';
import {
  createJournalPath,
  publishCreateJournal,
  readCreateJournal,
  withCreateJournalLock,
  type CreateJournal,
} from '../src/specs/create-journal';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-contract-Ż ')));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await mkdir(join(root, '.nevo'));
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\n');
  execFileSync('git', ['add', '.gitignore', '.nevo/config.yaml'], { cwd: root });
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial'],
    { cwd: root },
  );
  return (await bootstrapProjectHome(root)).context;
}

function currentJournal(
  context: Awaited<ReturnType<typeof fixture>>,
  targetWorkspaceId: string = randomUUID(),
): CreateJournal {
  const title = 'Current contract';
  const specId = randomUUID();
  const created = '2026-10-14';
  const scaffold = createSpecificationScaffold({ specId, title, created });
  const requestIntent = normalizeCreateClientIntent({
    title,
    target: { kind: 'existing', workspaceId: targetWorkspaceId },
  });
  return {
    version: 2,
    projectId: context.project.projectId,
    operationId: randomUUID(),
    requestIntent,
    inputFingerprint: fingerprintCreateClientIntent(requestIntent),
    specId,
    slug: scaffold.slug,
    title,
    created,
    stage: 'reserved',
    target: {
      kind: 'existing',
      workspaceId: targetWorkspaceId,
      workspaceRoot: context.project.homeRoot,
    },
    files: scaffold.files.map(({ relativePath, sha256 }) => ({ relativePath, sha256 })),
  };
}

async function seed(context: Awaited<ReturnType<typeof fixture>>, value: unknown, id: string) {
  await withCreateJournalLock(context, async () => {
    await writeFile(createJournalPath(context, id), JSON.stringify(value) + '\n');
  });
}

describe('Durable Create — one canonical journal and Specification format', () => {
  it('persists and reads the current journal without changing immutable evidence', async () => {
    const context = await fixture();
    const record = currentJournal(context);
    expect(record.files[0]?.relativePath).toBe('specs/active/current-contract/specification.yaml');
    await withCreateJournalLock(context, () => publishCreateJournal(context, record));
    expect(await readCreateJournal(context, record.operationId)).toEqual(record);
  });

  it('rejects unpublished journal v1 and change.yaml rather than migrating them', async () => {
    const context = await fixture();
    const record = currentJournal(context);
    await seed(context, { ...record, version: 1 }, record.operationId);
    await expect(readCreateJournal(context, record.operationId)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });

    await seed(
      context,
      {
        ...record,
        files: [
          { ...record.files[0]!, relativePath: 'specs/active/current-contract/change.yaml' },
          record.files[1],
        ],
      },
      record.operationId,
    );
    await expect(readCreateJournal(context, record.operationId)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });
  });

  it('rejects unknown or case-alias manifest filenames', async () => {
    const context = await fixture();
    const record = currentJournal(context);
    for (const name of ['unknown.yaml', 'Specification.yaml', '../specification.yaml']) {
      await seed(
        context,
        {
          ...record,
          files: [
            { ...record.files[0]!, relativePath: 'specs/active/' + record.slug + '/' + name },
            record.files[1],
          ],
        },
        record.operationId,
      );
      await expect(readCreateJournal(context, record.operationId)).rejects.toMatchObject({
        code: 'CREATE_JOURNAL_CORRUPT',
      });
    }
  });

  it('resumes the current reserved journal only via trusted operator recovery', async () => {
    const context = await fixture();
    const engine = await openSpecFlowEngine({ cwd: context.project.homeRoot });
    const record = currentJournal(context, engine.workspace.workspaceId);
    await seed(context, record, record.operationId);

    const result = await createSpecification(
      engine,
      {
        operationId: record.operationId,
        title: record.title,
        created: record.created,
        target: { kind: 'existing', workspaceId: engine.workspace.workspaceId },
      },
      { resumeInterruptedOperation: true },
    );
    expect(result.specId).toBe(record.specId);
    expect(result.relativeManifestPath).toBe(record.files[0]!.relativePath);
    expect(await readFile(join(result.workspaceRoot, result.relativeManifestPath), 'utf8')).toBe(
      createSpecificationScaffold({
        specId: record.specId,
        title: record.title,
        created: record.created,
      }).files[0]!.content,
    );
    expect((await readCreateJournal(context, record.operationId))?.stage).toBe('completed');
    expect(
      (await engine.readRegistry()).specBindings.filter((x) => x.specId === record.specId),
    ).toHaveLength(1);
  }, 120000);

  it('rejects extra fields in existing and linked worktree targets', async () => {
    const context = await fixture();
    const record = currentJournal(context);
    for (const extra of [
      { instanceId: randomUUID() },
      { branch: 'unexpected' },
      { baseCommit: 'a'.repeat(40) },
      { unexpected: true },
    ]) {
      await seed(
        context,
        { ...record, target: { ...record.target, ...extra } },
        record.operationId,
      );
      await expect(readCreateJournal(context, record.operationId)).rejects.toMatchObject({
        code: 'CREATE_JOURNAL_CORRUPT',
      });
    }

    const target = {
      kind: 'new-worktree' as const,
      workspaceId: randomUUID(),
      workspaceRoot: join(dirname(context.project.homeRoot), 'worktree'),
      branch: 'spec/current-contract-12345678',
      baseCommit: 'a'.repeat(40),
      instanceId: randomUUID(),
    };
    const requestIntent = normalizeCreateClientIntent({
      title: record.title,
      target: { kind: 'new-worktree' },
    });
    const linked: CreateJournal = {
      ...record,
      requestIntent,
      inputFingerprint: fingerprintCreateClientIntent(requestIntent),
      target,
      gitPlan: {
        projectRoot: context.project.homeRoot,
        gitInstanceId: context.project.gitInstanceId,
      },
    };
    await seed(context, linked, record.operationId);
    expect(await readCreateJournal(context, record.operationId)).toEqual(linked);
    await seed(context, { ...linked, target: { ...target, unexpected: true } }, record.operationId);
    await expect(readCreateJournal(context, record.operationId)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });
  });

  it('rejects tampered fingerprints and mismatched Project Home Git identity', async () => {
    const context = await fixture();
    const record = currentJournal(context);
    await seed(context, { ...record, inputFingerprint: 'a'.repeat(64) }, record.operationId);
    await expect(readCreateJournal(context, record.operationId)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });

    const requestIntent = normalizeCreateClientIntent({
      title: record.title,
      target: { kind: 'new-worktree' },
    });
    const linked: CreateJournal = {
      ...record,
      requestIntent,
      inputFingerprint: fingerprintCreateClientIntent(requestIntent),
      target: {
        kind: 'new-worktree',
        workspaceId: randomUUID(),
        workspaceRoot: join(dirname(context.project.homeRoot), 'worktree'),
        branch: 'spec/current-contract-12345678',
        baseCommit: 'a'.repeat(40),
        instanceId: randomUUID(),
      },
      gitPlan: {
        projectRoot: context.project.homeRoot,
        gitInstanceId: context.project.gitInstanceId,
      },
    };
    await seed(context, linked, record.operationId);
    expect(await readCreateJournal(context, record.operationId)).toEqual(linked);
    await seed(
      context,
      { ...linked, gitPlan: { ...linked.gitPlan, gitInstanceId: randomUUID() } },
      record.operationId,
    );
    await expect(readCreateJournal(context, record.operationId)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });
  });

  it('distinguishes omitted and explicit baseRef in immutable user intent', () => {
    const omitted = normalizeCreateClientIntent({
      title: 'Same intent',
      target: { kind: 'new-worktree' },
    });
    const explicit = normalizeCreateClientIntent({
      title: 'Same intent',
      target: { kind: 'new-worktree', baseRef: 'HEAD' },
    });
    expect(fingerprintCreateClientIntent(omitted)).not.toBe(
      fingerprintCreateClientIntent(explicit),
    );
  });
});
