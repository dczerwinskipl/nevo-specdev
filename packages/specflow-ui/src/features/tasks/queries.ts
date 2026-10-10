/** Task query keys stay under the Specification scope for coordinated cache invalidation. */
export const taskKeys = {
  detail: (specId: string, taskId: string) => ['specifications', specId, 'task', taskId] as const,
};
