import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createLegacySpecificationScaffold } from '../src/specs/model';

import {
  SpecificationError,
  createSpecificationScaffold,
  listWorkspaceSpecifications,
  parseSpecificationManifest,
  readWorkspaceSpecification,
  validateSpecificationSlug,
  type SpecificationScaffold,
} from '../src/testing';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-specs-Ż ')));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

async function persist(root: string, scaffold: SpecificationScaffold): Promise<void> {
  for (const file of scaffold.files) {
    const absolute = join(root, file.relativePath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, file.content, 'utf8');
  }
}

describe('E2.T01 Specification manifest and canonical checkout repository', () => {
  it('creates a deterministic title-only scaffold using the canonical specification.yaml', async () => {
    const specId = randomUUID();
    const input = { specId, title: 'Żółty Projekt', created: '2026-10-14' };
    const first = createSpecificationScaffold(input);
    const second = createSpecificationScaffold(input);
    expect(first).toEqual(second);
    expect(first.slug).toBe('zolty-projekt');
    expect(first.files.map((item) => item.relativePath)).toEqual([
      'specs/active/zolty-projekt/specification.yaml',
      'specs/active/zolty-projekt/overview.md',
    ]);
    for (const file of first.files) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(first.files[0]?.content).toContain('spec_id: ' + specId);
    expect(first.files[0]?.content).not.toContain('workflow:');
    expect(first.files[0]?.content).not.toContain('mode: deterministic');

    const root = await workspace();
    await persist(root, first);
    const actual = await listWorkspaceSpecifications(root);
    expect(actual).toHaveLength(1);
    expect(actual[0]).toMatchObject({
      specId,
      slug: first.slug,
      title: 'Żółty Projekt',
      location: 'active',
      type: 'standard',
      status: 'draft',
      priority: 10,
      created: '2026-10-14',
      tasks: [],
      relativeManifestPath: first.files[0]?.relativePath,
    });
    expect(await readWorkspaceSpecification(root, specId)).toEqual(actual[0]);
    await expect(readFile(join(root, 'specs/index.generated.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('keeps historical change.yaml bytes and read identity without rewriting old Specs', async () => {
    const specId = randomUUID();
    const input = { specId, title: 'Historical manifest', created: '2026-10-14' };
    const oldScaffold = createLegacySpecificationScaffold(input);
    const nextScaffold = createSpecificationScaffold(input);
    expect(oldScaffold.files[0]?.relativePath).toBe('specs/active/historical-manifest/change.yaml');
    expect(oldScaffold.files[0]?.content).toContain('workflow:\n  mode: deterministic');
    expect(oldScaffold.files[0]?.sha256).not.toBe(nextScaffold.files[0]?.sha256);

    const root = await workspace();
    await persist(root, oldScaffold);
    const sourcePath = join(root, oldScaffold.files[0]!.relativePath);
    const sourceBytes = await readFile(sourcePath);
    const found = await readWorkspaceSpecification(root, specId);
    expect(found.relativeManifestPath).toBe(oldScaffold.files[0]?.relativePath);
    expect((await readFile(sourcePath)).equals(sourceBytes)).toBe(true);
    await expect(readFile(join(root, nextScaffold.files[0]!.relativePath))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects two manifest filenames rather than selecting a preferred source', async () => {
    const root = await workspace();
    const scaffold = createSpecificationScaffold({
      specId: randomUUID(),
      title: 'Ambiguous manifest',
      created: '2026-10-14',
    });
    await persist(root, scaffold);
    const directory = dirname(join(root, scaffold.files[0]!.relativePath));
    await writeFile(join(directory, 'change.yaml'), scaffold.files[0]!.content);
    await expect(listWorkspaceSpecifications(root)).rejects.toMatchObject({
      code: 'SPEC_SOURCE_INVALID',
    });
  });

  it('rejects incorrectly cased manifest names', async () => {
    const root = await workspace();
    const scaffold = createSpecificationScaffold({
      specId: randomUUID(),
      title: 'Wrong case',
      created: '2026-10-14',
    });
    const directory = dirname(join(root, scaffold.files[0]!.relativePath));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'Specification.yaml'), scaffold.files[0]!.content);
    await expect(listWorkspaceSpecifications(root)).rejects.toMatchObject({
      code: 'SPEC_SOURCE_INVALID',
    });
  });

  it('reflects manifest edits directly without a generated index or stale status cache', async () => {
    const root = await workspace();
    const scaffold = createSpecificationScaffold({
      specId: randomUUID(),
      title: 'Status source',
      created: '2026-10-14',
    });
    await persist(root, scaffold);
    const manifestPath = join(root, scaffold.files[0]!.relativePath);
    const original = await readFile(manifestPath, 'utf8');
    expect((await listWorkspaceSpecifications(root))[0]?.status).toBe('draft');
    await writeFile(manifestPath, original.replace('status: draft', 'status: approved'));
    expect((await listWorkspaceSpecifications(root))[0]?.status).toBe('approved');
  });

  it('rejects duplicate spec IDs across active/archive instead of choosing one silently', async () => {
    const root = await workspace();
    const specId = randomUUID();
    await persist(
      root,
      createSpecificationScaffold({ specId, title: 'Primary', created: '2026-10-14' }),
    );
    const other = createSpecificationScaffold({
      specId,
      title: 'Duplicate',
      created: '2026-10-14',
    });
    const target = join(root, 'specs/archive/duplicate');
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'specification.yaml'), other.files[0]!.content);
    await expect(listWorkspaceSpecifications(root)).rejects.toMatchObject({
      code: 'SPEC_CONFLICT',
    });
  });

  it('fails closed on missing identity, malformed YAML and non-file manifests', async () => {
    const root = await workspace();
    const scaffold = createSpecificationScaffold({
      specId: randomUUID(),
      title: 'Invalid source',
      created: '2026-10-14',
    });
    await persist(root, scaffold);
    const manifestPath = join(root, scaffold.files[0]!.relativePath);
    const original = await readFile(manifestPath, 'utf8');

    await writeFile(manifestPath, original.replace(/spec_id: .+\n/u, ''));
    await expect(listWorkspaceSpecifications(root)).rejects.toMatchObject({
      code: 'SPEC_SOURCE_INVALID',
    });

    await writeFile(manifestPath, 'id: [invalid\n');
    await expect(listWorkspaceSpecifications(root)).rejects.toMatchObject({
      code: 'SPEC_SOURCE_INVALID',
    });

    await rm(manifestPath);
    await mkdir(manifestPath);
    await expect(listWorkspaceSpecifications(root)).rejects.toMatchObject({
      code: 'SPEC_SOURCE_INVALID',
    });
    expect(
      (await readFile(join(root, scaffold.files[1]!.relativePath), 'utf8')).length,
    ).toBeGreaterThan(0);
  });

  it('rejects unsafe slugs, invalid creation inputs and absent specifications', async () => {
    const root = await workspace();
    expect(await listWorkspaceSpecifications(root)).toEqual([]);
    expect(() => validateSpecificationSlug('../escape')).toThrow(SpecificationError);
    expect(() =>
      createSpecificationScaffold({ specId: randomUUID(), title: '  ', created: '2026-10-14' }),
    ).toThrow(SpecificationError);
    expect(() =>
      createSpecificationScaffold({ specId: 'not-a-uuid', title: 'Valid', created: '2026-10-14' }),
    ).toThrow(SpecificationError);
    await expect(readWorkspaceSpecification(root, randomUUID())).rejects.toMatchObject({
      code: 'SPEC_NOT_FOUND',
    });
  });

  it('enforces portable Windows-safe slugs on every platform', () => {
    const invalid = [
      'con',
      'CON',
      'con.txt',
      'prn',
      'aux',
      'nul',
      'nul.log',
      'com1',
      'com9',
      'lpt1',
      'lpt9',
      'lpt2.txt',
      'example.',
      'trailing..',
      '../escape',
    ];
    for (const slug of invalid) {
      expect(() => validateSpecificationSlug(slug), slug).toThrow(SpecificationError);
    }
    for (const safe of ['content', 'con-text', 'auxiliary', 'com10', 'trailing.txt', 'spec-1']) {
      expect(validateSpecificationSlug(safe)).toBe(safe);
    }

    const specId = randomUUID();
    for (const title of ['CON', 'NUL', 'LPT1', 'COM9', 'AUX']) {
      const result = createSpecificationScaffold({ specId, title, created: '2026-10-14' });
      expect(result.slug).toBe(title.toLowerCase() + '-' + specId.slice(0, 8));
      expect(validateSpecificationSlug(result.slug)).toBe(result.slug);
      expect(result.files[0]?.relativePath).toBe('specs/active/' + result.slug + '/specification.yaml');
    }
  });

  it('does not invent missing required fields or a canonical status when reading', () => {
    expect(() =>
      parseSpecificationManifest(
        { id: 'demo', spec_id: randomUUID(), title: 'Title', tasks: [] },
        'demo',
        'active',
      ),
    ).toThrowError(SpecificationError);
  });
});
