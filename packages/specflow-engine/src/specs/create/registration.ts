import type { WorkspaceRegistration } from '../../project/workspace-registry';
import { CreateOperationError } from '../create-error';
import type { CreateJournal } from './journal-model';

/** Translate durable create intent into the canonical linked-workspace registration. */
export function registrationOf(record: CreateJournal): WorkspaceRegistration {
  if (!record.target.instanceId) {
    throw new CreateOperationError(
      'CREATE_RECOVERY_REQUIRED',
      'Linked worktree has no durable identity evidence.',
    );
  }
  return {
    kind: 'linked',
    managed: true,
    workspaceId: record.target.workspaceId,
    root: record.target.workspaceRoot,
    instanceId: record.target.instanceId,
  };
}
