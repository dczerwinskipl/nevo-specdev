import { describe, expect, it } from 'vitest';
import { createWorkspaceFixture } from './taskWorkspace.stories-support';
import { readDemoSession, withSessionDemoLinks } from './taskSessionDemo.stories-support';

describe('session demo snapshot handoff', () => {
  it.each(['running', 'idle', 'waitingForUser'] as const)(
    'preserves %s with the exact association',
    (status) => {
      const data = createWorkspaceFixture('review');
      const source = {
        ...data.sessions[0]!,
        status,
        role: undefined,
        question: status === 'waitingForUser' ? 'Fixture question?' : undefined,
      };
      const linked = withSessionDemoLinks({ ...data, sessions: [source] }).sessions[0]!;
      const destination = new URL(linked.href!, 'https://storybook.example.test/iframe.html');
      expect(destination.searchParams.get('id')).toBe(
        'specflow-screens-task-session-demo--session',
      );
      expect(readDemoSession(destination.search)).toEqual({ ...source, taskId: data.id });
      expect(source).not.toHaveProperty('href');
    },
  );
  it('does not substitute a default session for invalid or absent snapshots', () => {
    for (const search of ['', '?session=not-json', '?session=%7B%7D', '?session=null'])
      expect(readDemoSession(search)).toBeUndefined();
  });
});
