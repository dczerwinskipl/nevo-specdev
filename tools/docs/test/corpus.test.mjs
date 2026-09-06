import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CorpusError, inspectCorpus, loadValidatedCorpus } from '../src/corpus.mjs';

let root;
let docsDir;
let opts;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nevo-corpus-'));
  docsDir = join(root, 'docs');
  mkdirSync(join(docsDir, 'architecture', 'decisions'), { recursive: true });
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  opts = { docsDir, repoRoot: root };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const doc = (rel, fm) => writeFileSync(join(docsDir, rel), fm);
const fm = (o) =>
  `---\n${Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n# body\n`;

describe('loadValidatedCorpus', () => {
  it('returns the sorted docs when everything is valid', () => {
    doc('README.md', fm({ id: 'docs.readme', type: 'hub', title: 'Docs', status: 'current' }));
    doc(
      'architecture/decisions/0001-first.md',
      fm({
        id: 'adr.0001-first',
        type: 'adr',
        title: 'First',
        status: 'current',
        date: '2026-09-06',
      }),
    );
    const docs = loadValidatedCorpus(opts);
    expect(docs.map((d) => d.id)).toEqual(['adr.0001-first', 'docs.readme']);
  });

  it('throws CorpusError listing every problem — discovery never serves a broken set', () => {
    doc('README.md', fm({ id: 'docs.readme', type: 'hub', title: 'Docs', status: 'current' }));
    doc('random-notes.md', '# no frontmatter\n');
    doc(
      'architecture/decisions/0002-skips.md', // gap: no 0001
      fm({ id: 'adr.0002-skips', type: 'adr', title: 'Skips', status: 'current', date: 'bad' }),
    );

    let err;
    try {
      loadValidatedCorpus(opts);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CorpusError);
    const joined = err.problems.join('\n');
    expect(joined).toMatch(/random-notes\.md: missing frontmatter/);
    expect(joined).toMatch(/'date' must be ISO/);
    expect(joined).toMatch(/numbering has a gap|gap-free/);
  });
});

describe('inspectCorpus', () => {
  it('returns docs + problems without throwing', () => {
    doc('README.md', fm({ id: 'docs.readme', type: 'hub', title: 'Docs', status: 'current' }));
    doc(
      'orphan.md',
      fm({
        id: 'x.orphan',
        type: 'development',
        title: 'X',
        status: 'current',
        read_when: '[a]',
        summary: 's',
        related: '[nope.missing]',
      }),
    );
    const { docs, problems } = inspectCorpus(opts);
    expect(docs.length).toBe(2);
    expect(problems.join('\n')).toMatch(/unresolved reference 'nope\.missing'/);
  });
});
