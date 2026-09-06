import { describe, expect, it } from 'vitest';

import { createAdr } from '../../src/app/create-adr.js';
import { CorpusInvalidError } from '../../src/errors.js';
import { createMemoryRepo } from '../support/memory-repo.js';

const fm = (o: Record<string, string>): string =>
  `---\n${Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n# body\n`;

const baseRepo = () =>
  createMemoryRepo({
    'docs/README.md': fm({ id: 'docs.readme', type: 'hub', title: 'Docs', status: 'current' }),
    'docs/architecture/decisions/0001-first.md': fm({
      id: 'adr.0001-first',
      type: 'adr',
      title: 'First',
      status: 'current',
      date: '2026-09-06',
      summary: 'A real decision.',
    }),
  });

describe('createAdr', () => {
  it('writes the next draft ADR and regenerates the index', () => {
    const repo = baseRepo();
    const result = createAdr(repo, { title: 'Use X for Y', date: '2026-09-06' });
    expect(result.written).toBe(true);
    expect(result.indexRegenerated).toBe(true);
    expect(repo.files.get('docs/architecture/decisions/0002-use-x-for-y.md')).toContain(
      'status: draft',
    );
    expect(repo.readIndex().md).toContain('adr.0002-use-x-for-y');
  });

  it('dry-run writes nothing', () => {
    const repo = baseRepo();
    const result = createAdr(repo, { title: 'Use X for Y', date: '2026-09-06', dryRun: true });
    expect(result.written).toBe(false);
    expect(repo.writes).toEqual([]);
  });

  it('refuses to add on top of an already-invalid corpus', () => {
    const repo = baseRepo();
    repo.files.set('docs/broken.md', '# no frontmatter\n');
    expect(() => createAdr(repo, { title: 'X', date: '2026-09-06' })).toThrow(CorpusInvalidError);
    expect(repo.writes).toEqual([]);
  });

  it('rolls the new file back if the post-write corpus check fails', () => {
    const repo = baseRepo();
    // A second ADR dir file that will create a numbering gap once 0002 is added
    // is not possible here; instead simulate a scan that fails by planting a
    // colliding id via an extra README-less doc AFTER planNewAdr computed 0002.
    // Simplest deterministic trigger: pre-existing broken doc appears between
    // plan and re-scan — emulate by overriding scan once.
    const realScan = repo.scan.bind(repo);
    let calls = 0;
    (repo as { scan: typeof repo.scan }).scan = () => {
      calls += 1;
      const r = realScan();
      if (calls >= 2) {
        return { docs: r.docs, missingFrontmatter: [...r.missingFrontmatter, 'docs/ghost.md'] };
      }
      return r;
    };
    expect(() => createAdr(repo, { title: 'Later', date: '2026-09-06' })).toThrow(
      CorpusInvalidError,
    );
    expect(repo.removes).toContain('docs/architecture/decisions/0002-later.md');
    expect(repo.files.has('docs/architecture/decisions/0002-later.md')).toBe(false);
  });
});
