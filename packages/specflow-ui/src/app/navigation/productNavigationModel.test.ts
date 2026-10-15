import { describe, expect, it } from 'vitest';
import { productNavigationItems } from './productNavigationModel';

describe('product navigation model', () => {
  it('declares destinations and capability availability together, without inventing Tasks', () => {
    const items = productNavigationItems('a/b', '/specs/a%2Fb/documents/spec');
    expect(items.map((item) => item.id)).toEqual([
      'overview',
      'sessions',
      'tasks',
      'documents',
      'changes',
      'repository',
    ]);
    expect(items.find((item) => item.id === 'tasks')).toMatchObject({ to: null, active: false });
    expect(items.filter((item) => item.active).map((item) => item.id)).toEqual(['documents']);
    expect(productNavigationItems('a', '/specs/a', false).map((item) => item.id)).toEqual([
      'overview',
      'sessions',
      'tasks',
      'documents',
    ]);
  });
  it('matches complete path boundaries and selects only exact Overview', () => {
    expect(
      productNavigationItems('a', '/specs/a/documents-other').some((item) => item.active),
    ).toBe(false);
    expect(
      productNavigationItems('a', '/specs/a')
        .filter((item) => item.active)
        .map((item) => item.id),
    ).toEqual(['overview']);
    expect(productNavigationItems(null, '/').some((item) => item.active)).toBe(false);
  });
});
