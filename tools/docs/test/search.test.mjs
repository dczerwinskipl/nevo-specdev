import { describe, expect, it } from 'vitest';

import { normalizeTerm, tokenize, scoreDoc, searchDocs } from '../src/search.mjs';

const CORPUS = [
  {
    id: 'development.git-workflow',
    type: 'development',
    title: 'Git workflow',
    status: 'current',
    file: 'docs/development/git-workflow.md',
    read_when: ['creating a branch', 'preparing a pull request'],
    summary: 'Branch naming, PR strategy, squash merge, release lines.',
    related: ['development.commit-conventions'],
  },
  {
    id: 'development.ui.react.component-guidelines',
    type: 'development',
    title: 'React component guidelines',
    status: 'current',
    file: 'docs/development/ui/react/component-guidelines.md',
    read_when: ['writing a React component'],
    summary: 'Composition, props, and Tailwind class conventions for React components.',
  },
  {
    id: 'product.shared.localization',
    type: 'product',
    title: 'Localization',
    status: 'current',
    file: 'docs/product/shared/localization.md',
    read_when: ['adding user-facing copy'],
    summary:
      'All user-facing strings must be localizable even while the first release is English-only.',
  },
];

describe('normalizeTerm', () => {
  it('singularizes common plurals', () => {
    expect(normalizeTerm('conventions')).toBe('convention');
    expect(normalizeTerm('guidelines')).toBe('guideline');
    expect(normalizeTerm('branches')).toBe('branch');
  });
});

describe('tokenize', () => {
  it('splits, normalizes and de-duplicates', () => {
    expect(tokenize('React, react components!')).toEqual(['react', 'component']);
  });
});

describe('scoreDoc', () => {
  it('scores a full-coverage query above a partial one', () => {
    const full = scoreDoc(CORPUS[0], 'git workflow');
    const partial = scoreDoc(CORPUS[0], 'git bicycle');
    expect(full.score).toBeGreaterThan(partial.score);
    expect(full.matchedTerms).toContain('git');
  });

  it('returns 0 for no match', () => {
    expect(scoreDoc(CORPUS[0], 'kubernetes').score).toBe(0);
  });
});

describe('searchDocs', () => {
  it('ranks the git doc first for a git query and is deterministic', () => {
    const a = searchDocs(CORPUS, { query: 'pull request branch' });
    const b = searchDocs(CORPUS, { query: 'pull request branch' });
    expect(a.map((d) => d.id)).toEqual(b.map((d) => d.id));
    expect(a[0].id).toBe('development.git-workflow');
  });

  it('filters by type', () => {
    const results = searchDocs(CORPUS, { type: 'product' });
    expect(results.map((d) => d.id)).toEqual(['product.shared.localization']);
  });

  it('honors limit', () => {
    expect(
      searchDocs(CORPUS, { query: 'component react localization git', limit: 1 }),
    ).toHaveLength(1);
  });
});
