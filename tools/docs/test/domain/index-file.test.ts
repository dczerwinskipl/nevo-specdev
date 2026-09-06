import { describe, expect, it } from 'vitest';

import type { DocRecord } from '../../src/domain/frontmatter.js';
import { buildIndex, diffIndex } from '../../src/domain/index-file.js';

const DOCS: DocRecord[] = [
  {
    id: 'development.git-workflow',
    type: 'development',
    title: 'Git workflow',
    status: 'current',
    file: 'docs/development/git-workflow.md',
    body: '',
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
    body: '',
  },
];

describe('buildIndex', () => {
  it('is deterministic, orders hubs first, carries no timestamp', () => {
    const a = buildIndex(DOCS);
    const b = buildIndex([...DOCS].reverse());
    expect(a.md).toBe(b.md);
    expect(a.json).toBe(b.json);
    const parsed = JSON.parse(a.json) as { docs: { id: string }[] };
    expect(parsed.docs[0]?.id).toBe('docs.readme');
    expect(a.md).not.toMatch(/[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
    expect(a.json).not.toMatch(/[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
  });
});

describe('diffIndex', () => {
  it('reports missing, then clean, then stale', () => {
    const built = buildIndex(DOCS);
    expect(diffIndex(built, { md: null, json: null }).join('\n')).toMatch(/missing/);
    expect(diffIndex(built, { md: built.md, json: built.json })).toEqual([]);
    const stale = buildIndex([{ ...DOCS[0]!, summary: 'different' }, DOCS[1]!]);
    expect(diffIndex(built, { md: stale.md, json: stale.json }).join('\n')).toMatch(/stale/);
  });
});
