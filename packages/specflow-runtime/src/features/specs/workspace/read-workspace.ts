import type {
  SpecificationWorkspaceRepository,
  WorkspaceContributions,
  WorkspaceReadModel,
} from './repository';

/** Specs composes lightweight owner contributions; it never reads foreign bodies or history. */
export async function readWorkspace(
  source: SpecificationWorkspaceRepository,
  contributions: WorkspaceContributions | undefined,
  specId: string,
): Promise<WorkspaceReadModel | null> {
  const specification = await source.readSpecification(specId);
  if (!specification) return null;
  const missing = { state: 'unavailable' as const, reason: 'not_implemented' as const };
  const [tasks, documents, sessions] = await Promise.all([
    contributions?.tasks?.(specId),
    contributions?.documents?.(specId),
    contributions?.sessions?.(specId),
  ]);
  return {
    ...specification,
    ...(sessions?.recommendedSessionId
      ? { recommendedSessionId: sessions.recommendedSessionId }
      : {}),
    sections: {
      ...specification.sections,
      tasks: tasks ?? missing,
      documents: documents ?? missing,
      sessions: sessions?.section ?? missing,
    },
  };
}
