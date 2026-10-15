import { describe, it, expect } from 'vitest';
import { projectSessionNavigation } from './summary';
import { createSpecificationWorkspaceFixture } from '../../../../test-support/specs/workspace/fixtures';
const base = createSpecificationWorkspaceFixture('working', 's');
describe('Sessions navigation summary', () => {
  it('preserves unknown, unavailable, partial and forbidden instead of claiming zero', () => {
    expect(projectSessionNavigation(undefined, undefined)).toEqual({ state: 'unknown' });
    expect(projectSessionNavigation(undefined, undefined, true)).toEqual({ state: 'loading' });
    expect(
      projectSessionNavigation(
        { ...base, sectionAvailability: { sessions: 'unavailable' } },
        undefined,
      ),
    ).toEqual({ state: 'unavailable' });
    expect(
      projectSessionNavigation(base, Object.assign(new Error('denied'), { status: 403 })),
    ).toEqual({ state: 'forbidden' });
    expect(
      projectSessionNavigation(
        {
          ...base,
          sessions: [
            {
              id: 'unknown',
              title: 'Agent running',
              activity: { label: 'Waiting for your reply' },
            },
          ],
        },
        undefined,
      ),
    ).toMatchObject({ state: 'partial', count: undefined, entries: [] });
  });
  it('orders known attention before activity, bounds references and retains exact complete count', () => {
    const sessions = Array.from({ length: 5 }, (_, index) => ({
      id: `session-${index}`,
      title: `Session ${index}`,
      activityCode: index === 3 ? ('attention' as const) : ('active' as const),
    }));
    expect(projectSessionNavigation({ ...base, sessions }, undefined)).toMatchObject({
      state: 'available',
      count: 5,
      entries: [sessions[3], sessions[0], sessions[1]],
      attention: true,
    });
    expect(projectSessionNavigation({ ...base, sessions }, new Error('refresh'))).toMatchObject({
      state: 'stale',
      count: undefined,
      entries: [sessions[3], sessions[0], sessions[1]],
    });
  });
  it('does not label known quiet history as active or infer its completion', () => {
    expect(
      projectSessionNavigation(
        { ...base, sessions: [{ id: 'quiet', title: 'Quiet session', navigationStatus: 'quiet' }] },
        undefined,
      ),
    ).toMatchObject({ state: 'available', count: 0, entries: [] });
  });
});
