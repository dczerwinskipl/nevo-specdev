import type { TaskWorkspaceData, WorkspaceSession } from './taskWorkspaceModel';

export type DemoSession = Omit<WorkspaceSession, 'href'> & { readonly taskId: string };

/** Development-only handoff: the new tab receives the exact displayed fixture snapshot. */
export function withSessionDemoLinks(data: TaskWorkspaceData): TaskWorkspaceData {
  return {
    ...data,
    sessions: data.sessions.map(({ href: _href, ...session }) => ({
      ...session,
      href: `./iframe.html?${new URLSearchParams({
        id: 'specflow-screens-task-session-demo--session',
        viewMode: 'story',
        session: JSON.stringify({ ...session, taskId: data.id }),
      })}`,
    })),
  };
}

export function readDemoSession(search: string): DemoSession | undefined {
  try {
    const value: unknown = JSON.parse(new URLSearchParams(search).get('session') ?? 'null');
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    if (
      ['id', 'title', 'provider', 'step', 'taskId'].some(
        (key) => typeof item[key] !== 'string' || !item[key],
      )
    )
      return;
    if (
      typeof item.current !== 'boolean' ||
      typeof item.attempt !== 'number' ||
      !Number.isSafeInteger(item.attempt) ||
      item.attempt < 1
    )
      return;
    if (item.status !== 'running' && item.status !== 'idle' && item.status !== 'waitingForUser')
      return;
    if (
      ['role', 'providerId', 'question'].some(
        (key) => item[key] !== undefined && typeof item[key] !== 'string',
      )
    )
      return;
    return {
      id: item.id as string,
      title: item.title as string,
      provider: item.provider as string,
      step: item.step as string,
      taskId: item.taskId as string,
      current: item.current,
      attempt: item.attempt,
      status: item.status,
      role: item.role as string | undefined,
      providerId: item.providerId as string | undefined,
      question: item.question as string | undefined,
    };
  } catch {
    return;
  }
}
