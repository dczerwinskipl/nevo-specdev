import { describe, expect, it } from 'vitest';

import { parseFrontmatter, validateDoc, validateCorpus } from '../src/frontmatter.mjs';

describe('parseFrontmatter', () => {
  it('returns null when there is no frontmatter block', () => {
    expect(parseFrontmatter('# Just a heading\n')).toBeNull();
  });

  it('parses a YAML block and trims folded-scalar trailing newlines', () => {
    const fm = parseFrontmatter(
      ['---', 'id: development.git-workflow', 'summary: >', '  one line', '---', '', '# Body'].join(
        '\n',
      ),
    );
    expect(fm).toMatchObject({ id: 'development.git-workflow', summary: 'one line' });
  });

  it('throws with the label on invalid YAML', () => {
    expect(() => parseFrontmatter('---\nid: [unclosed\n---\n', 'docs/x.md')).toThrow(/docs\/x\.md/);
  });
});

describe('validateDoc', () => {
  it('accepts a well-formed development doc', () => {
    expect(
      validateDoc({
        file: 'docs/development/x.md',
        id: 'development.x',
        type: 'development',
        title: 'X',
        status: 'current',
        read_when: ['doing x'],
        summary: 'about x',
      }),
    ).toEqual([]);
  });

  it('flags missing required fields, unknown type, and bad read_when', () => {
    const problems = validateDoc({
      file: 'docs/bad.md',
      id: 'bad',
      type: 'mystery',
      read_when: [],
    });
    expect(problems.join('\n')).toMatch(/unknown type 'mystery'/);
    expect(problems.join('\n')).toMatch(/read_when' must be a non-empty array/);
  });
});

describe('validateCorpus', () => {
  it('flags duplicate ids and unresolved related refs', () => {
    const problems = validateCorpus([
      { file: 'a.md', id: 'dup', related: ['missing.doc'] },
      { file: 'b.md', id: 'dup' },
    ]);
    expect(problems.join('\n')).toMatch(/duplicate id 'dup'/);
    expect(problems.join('\n')).toMatch(/unresolved reference 'missing\.doc'/);
  });
});
