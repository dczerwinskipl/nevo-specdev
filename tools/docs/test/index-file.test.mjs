import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
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

describe('buildIndex', () => {
  it('is deterministic and orders hubs before development', () => {
    const a = buildIndex(DOCS);
    const b = buildIndex([...DOCS].reverse());
    expect(a.md).toBe(b.md);
    expect(a.json.docs[0].id).toBe('docs.readme');
    expect(a.md).not.toMatch(/_Generated:/);
  });
});

describe('checkIndex', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nevo-docs-'));
    mkdirSync(join(dir, 'docs'), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reports missing index, then passes after writeIndex', () => {
    const docsDir = join(dir, 'docs');
    expect(checkIndex(DOCS, docsDir).join('\n')).toMatch(/missing: docs\/index\.generated/);
    writeIndex(DOCS, docsDir);
    expect(checkIndex(DOCS, docsDir)).toEqual([]);
  });

  it('reports stale index when a doc changes', () => {
    const docsDir = join(dir, 'docs');
    writeIndex(DOCS, docsDir);
    const changed = [{ ...DOCS[0], summary: 'different' }, DOCS[1]];
    expect(checkIndex(changed, docsDir).join('\n')).toMatch(/stale: docs\/index\.generated/);
  });

  it('surfaces frontmatter problems before touching the index', () => {
    const docsDir = join(dir, 'docs');
    writeFileSync(join(docsDir, 'index.generated.json'), '{}');
    const problems = checkIndex([{ file: 'docs/x.md', id: 'x', type: 'development' }], docsDir);
    expect(problems.join('\n')).toMatch(/missing required field/);
  });
});
