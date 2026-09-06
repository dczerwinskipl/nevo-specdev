import { describe, expect, it } from 'vitest';

import {
  parseFrontmatter,
  validateCorpus,
  validateDoc,
  type DocRecord,
} from '../../src/domain/frontmatter.js';

const doc = (over: Partial<DocRecord>): DocRecord => ({ file: 'docs/x.md', body: '', ...over });

describe('parseFrontmatter', () => {
  it('returns null when there is no frontmatter block', () => {
    expect(parseFrontmatter('# Just a heading\n')).toBeNull();
  });

  it('parses the YAML block, trims folded-scalar newlines, and returns the body', () => {
    const parsed = parseFrontmatter(
      ['---', 'id: development.git-workflow', 'summary: >', '  one line', '---', '', '# Body'].join(
        '\n',
      ),
    );
    expect(parsed?.frontmatter).toMatchObject({
      id: 'development.git-workflow',
      summary: 'one line',
    });
    expect(parsed?.body).toBe('# Body');
  });

  it('throws with the label on invalid YAML', () => {
    expect(() => parseFrontmatter('---\nid: [unclosed\n---\n', 'docs/x.md')).toThrow(/docs\/x\.md/);
  });
});

describe('validateDoc', () => {
  it('accepts a well-formed development doc', () => {
    expect(
      validateDoc(
        doc({
          id: 'development.x',
          type: 'development',
          title: 'X',
          status: 'current',
          read_when: ['doing x'],
          summary: 'about x',
        }),
      ),
    ).toEqual([]);
  });

  it('flags missing required fields, unknown type, and bad read_when', () => {
    const problems = validateDoc(doc({ id: 'bad', type: 'mystery', read_when: [] })).join('\n');
    expect(problems).toMatch(/unknown type 'mystery'/);
    expect(problems).toMatch(/read_when' must be a non-empty array/);
  });
});

describe('validateCorpus', () => {
  it('flags duplicate ids and unresolved related refs', () => {
    const problems = validateCorpus([
      doc({ file: 'a.md', id: 'dup', related: ['missing.doc'] }),
      doc({ file: 'b.md', id: 'dup' }),
    ]).join('\n');
    expect(problems).toMatch(/duplicate id 'dup'/);
    expect(problems).toMatch(/unresolved reference 'missing\.doc'/);
  });
});
