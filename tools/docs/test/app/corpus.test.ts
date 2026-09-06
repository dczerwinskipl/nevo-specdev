import { describe, expect, it } from 'vitest';

import { inspectCorpus, loadValidatedCorpus } from '../../src/app/load-corpus.js';
import { CorpusInvalidError } from '../../src/errors.js';
import { createMemoryRepo } from '../support/memory-repo.js';

const fm = (o: Record<string, string>): string =>
  `---\n${Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n# body\n`;

describe('loadValidatedCorpus', () => {
  it('returns the sorted docs when everything is valid', () => {
    const repo = createMemoryRepo({
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
    expect(loadValidatedCorpus(repo).map((d) => d.id)).toEqual(['adr.0001-first', 'docs.readme']);
  });

  it('throws CorpusInvalidError listing every problem', () => {
    const repo = createMemoryRepo({
      'docs/README.md': fm({ id: 'docs.readme', type: 'hub', title: 'Docs', status: 'current' }),
      'docs/random-notes.md': '# no frontmatter\n',
      'docs/architecture/decisions/0002-skips.md': fm({
        id: 'adr.0002-skips',
        type: 'adr',
        title: 'Skips',
        status: 'current',
        date: 'bad',
        summary: 'x',
      }),
    });
    try {
      loadValidatedCorpus(repo);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(CorpusInvalidError);
      const joined = (err as CorpusInvalidError).problems.join('\n');
      expect(joined).toMatch(/random-notes\.md: missing frontmatter/);
      expect(joined).toMatch(/'date' must be ISO/);
      expect(joined).toMatch(/numbering has a gap|gap-free/);
    }
  });
});

describe('inspectCorpus', () => {
  it('returns docs + problems without throwing', () => {
    const repo = createMemoryRepo({
      'docs/README.md': fm({ id: 'docs.readme', type: 'hub', title: 'Docs', status: 'current' }),
      'docs/orphan.md': fm({
        id: 'x.orphan',
        type: 'development',
        title: 'X',
        status: 'current',
        read_when: '[a]',
        summary: 's',
        related: '[nope.missing]',
      }),
    });
    const { docs, problems } = inspectCorpus(repo);
    expect(docs.length).toBe(2);
    expect(problems.join('\n')).toMatch(/unresolved reference 'nope\.missing'/);
  });
});
