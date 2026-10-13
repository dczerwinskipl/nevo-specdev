import type { TaskHumanRequirement, TaskSnapshot } from '@nevo/specflow-contracts/specs/workspace';

export interface TaskInspectionAnchor {
  readonly revision?: string;
}

export function inspectionAnchor(snapshot?: TaskSnapshot): TaskInspectionAnchor {
  return { revision: snapshot?.revision };
}

export function inspectionStep(snapshot?: TaskSnapshot) {
  const work = snapshot?.sections.work;
  if (work?.state !== 'available') return undefined;
  const position = work.data.position;
  return position.state === 'active'
    ? position.step
    : position.state === 'checkpoint' || position.state === 'not_started'
      ? (position.next ?? undefined)
      : undefined;
}

/** A human requirement may enrich only the exact execution (or unstarted next step). */
export function matchesWork(
  snapshot: TaskSnapshot | undefined,
  taskId: string,
  requirement: TaskHumanRequirement,
): boolean {
  const work = snapshot?.sections.work;
  const step = inspectionStep(snapshot);
  if (!snapshot || work?.state !== 'available' || step?.executor !== 'human') return false;
  if (
    requirement.state !== 'pending' ||
    requirement.source.kind !== 'human-step' ||
    requirement.source.stepId !== step.id ||
    requirement.definitionRevision !== work.data.definition.revision
  )
    return false;
  const position = work.data.position;
  if (position.state !== 'active') {
    return requirement.source.relation === 'next-ready' && requirement.key === null;
  }
  const key = requirement.key;
  return (
    requirement.source.relation === 'current' &&
    !!key &&
    key.specId === snapshot.specification.id &&
    key.taskId === taskId &&
    position.key.specId === key.specId &&
    position.key.taskId === key.taskId &&
    key.stepId === step.id &&
    position.key.stepId === key.stepId &&
    key.attempt === position.key.attempt
  );
}
