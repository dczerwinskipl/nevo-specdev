import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildIndex, checkIndex, writeIndex } from '../src/index-file.mjs';

const DOCS = [
  {
    id: 'development.git-workflow',
    type: 'development',
    title: 'Git workflow',
    status: 'current',
    file: 'docs/development/git-workflow.md',
    read_when: ['creating a branch'],
    summary: 'Branch and merge model.',
    related: [],
  },
  {
    id: 'docs.readme',
    type: 'hub',
    title: 'Documentation',
    status: 'current',
    file: 'docs/README.md',
  },
];

const corpus = (docs, problems = []) => ({ docs, problems });

describe('buildIndex', () => {
  it('is deterministic, orders hubs first, carries no timestamp', () => {
    const a = buildIndex(DOCS);
    const b = buildIndex([...DOCS].reverse());
    expect(a.md).toBe(b.md);
    expect(a.json.docs[0].id).toBe('docs.readme');
    expect(a.md).not.toMatch(/_Generated:|[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
    expect(JSON.stringify(a.json)).not.toMatch(/generated|[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
  });
});

describe('writeIndex / checkIndex', () => {
  let docsDir;
  beforeEach(() => {
    docsDir = join(mkdtempSync(join(tmpdir(), 'nevo-idx-')), 'docs');
    mkdirSync(docsDir, { recursive: true });
  });
  afterEach(() => rmSync(join(docsDir, '..'), { recursive: true, force: true }));

  it('writing twice with no source change produces identical bytes', () => {
    writeIndex(DOCS, docsDir);
    const md1 = readFileSync(join(docsDir, 'index.generated.md'), 'utf8');
    const json1 = readFileSync(join(docsDir, 'index.generated.json'), 'utf8');
    writeIndex(DOCS, docsDir);
    expect(readFileSync(join(docsDir, 'index.generated.md'), 'utf8')).toBe(md1);
    expect(readFileSync(join(docsDir, 'index.generated.json'), 'utf8')).toBe(json1);
    expect(checkIndex(corpus(DOCS), docsDir)).toEqual([]);
  });

  it('reports missing index, then passes after writeIndex', () => {
    expect(checkIndex(corpus(DOCS), docsDir).join('\n')).toMatch(/missing: docs\/index\.generated/);
    writeIndex(DOCS, docsDir);
    expect(checkIndex(corpus(DOCS), docsDir)).toEqual([]);
  });

  it('reports stale index when a doc changes', () => {
    writeIndex(DOCS, docsDir);
    const changed = [{ ...DOCS[0], summary: 'different' }, DOCS[1]];
    expect(checkIndex(corpus(changed), docsDir).join('\n')).toMatch(
      /stale: docs\/index\.generated/,
    );
  });

  it('surfaces pre-collected corpus problems and stops before the index check', () => {
    writeIndex(DOCS, docsDir);
    const problems = checkIndex(corpus(DOCS, ['docs/x.md: missing frontmatter']), docsDir);
    expect(problems).toEqual(['docs/x.md: missing frontmatter']);
  });
});
