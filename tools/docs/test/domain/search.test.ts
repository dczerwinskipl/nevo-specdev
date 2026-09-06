import { describe, expect, it } from 'vitest';

import { normalizeTerm, scoreDoc, searchDocs, tokenize } from '../../src/domain/search.js';
import type { DocRecord } from '../../src/domain/frontmatter.js';

const CORPUS: DocRecord[] = [
  {
    id: 'development.git-workflow',
    type: 'development',
    title: 'Git workflow',
    status: 'current',
    file: 'docs/development/git-workflow.md',
    body: '',
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
    body: '',
    read_when: ['writing a React component'],
    summary: 'Composition, props, and Tailwind class conventions for React components.',
  },
  {
    id: 'product.shared.localization',
    type: 'product',
    title: 'Localization',
    status: 'current',
    file: 'docs/product/shared/localization.md',
    body: '',
    read_when: ['adding user-facing copy'],
    summary: 'All user-facing strings must be localizable.',
  },
];

describe('normalizeTerm / tokenize', () => {
  it('singularizes and de-duplicates', () => {
    expect(normalizeTerm('conventions')).toBe('convention');
    expect(normalizeTerm('branches')).toBe('branch');
    expect(tokenize('React, react components!')).toEqual(['react', 'component']);
  });
});

describe('scoreDoc', () => {
  it('scores full coverage above partial and zero for no match', () => {
    expect(scoreDoc(CORPUS[0]!, 'git workflow').score).toBeGreaterThan(
      scoreDoc(CORPUS[0]!, 'git bicycle').score,
    );
    expect(scoreDoc(CORPUS[0]!, 'kubernetes').score).toBe(0);
  });
});

describe('searchDocs', () => {
  it('ranks deterministically and filters by type / limit', () => {
    const a = searchDocs(CORPUS, { query: 'pull request branch' });
    const b = searchDocs(CORPUS, { query: 'pull request branch' });
    expect(a.map((d) => d.id)).toEqual(b.map((d) => d.id));
    expect(a[0]?.id).toBe('development.git-workflow');
    expect(searchDocs(CORPUS, { type: 'product' }).map((d) => d.id)).toEqual([
      'product.shared.localization',
    ]);
    expect(searchDocs(CORPUS, { query: 'component react git', limit: 1 })).toHaveLength(1);
  });

  it('excludeStatuses drops deprecated/superseded so a replacement wins context', () => {
    const withHistory: DocRecord[] = [
      ...CORPUS,
      {
        id: 'development.git-workflow-old',
        type: 'development',
        title: 'Old git workflow',
        status: 'superseded',
        superseded_by: 'development.git-workflow',
        file: 'docs/development/git-workflow-old.md',
        body: '',
        read_when: ['creating a branch'],
        summary: 'Old branch naming and PR strategy. Superseded.',
      },
    ];
    const context = searchDocs(withHistory, {
      query: 'branch pull request strategy',
      excludeStatuses: ['deprecated', 'superseded'],
    });
    expect(context.map((d) => d.id)).not.toContain('development.git-workflow-old');
    expect(context[0]?.id).toBe('development.git-workflow');
    // list/find (no exclusion) still surface the historical doc.
    expect(
      searchDocs(withHistory, { query: 'branch pull request strategy' }).map((d) => d.id),
    ).toContain('development.git-workflow-old');
  });
});
