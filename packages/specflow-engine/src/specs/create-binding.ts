import type { SpecFlowEngine } from '../application';
import { updateWorkspaceRegistry } from '../project/registry-store';
import { addWorkspace, bindSpecToWorkspace } from '../project/workspace-registry';
import { registrationOf } from './create/registration';
import { CreateOperationError, type CreateJournal } from './create-journal';

/** Registry publication is idempotent but never rebinds another workspace. */
export async function commitBinding(engine: SpecFlowEngine, record: CreateJournal): Promise<void> {
  const registry = await engine.readRegistry();
  const existingBinding = registry.specBindings.find((item) => item.specId === record.specId);
  const existingWorkspace = registry.workspaces.find(
    (item) => item.workspaceId === record.target.workspaceId,
  );
  if (existingBinding && existingBinding.workspaceId !== record.target.workspaceId) {
    throw recovery('Specification is bound to another workspace.');
  }
  if (record.target.kind === 'new-worktree' && existingWorkspace) {
    const expected = registrationOf(record);
    if (
      existingWorkspace.root !== expected.root ||
      existingWorkspace.instanceId !== expected.instanceId ||
      existingWorkspace.kind !== 'linked'
    ) {
      throw recovery('Workspace registry identity differs from durable intent.');
    }
  }
  if (existingBinding && (record.target.kind === 'existing' || existingWorkspace)) return;

  await updateWorkspaceRegistry(engine.context, (current) => {
    let updated = current;
    if (record.target.kind === 'new-worktree') {
      const workspace = current.workspaces.find(
        (item) => item.workspaceId === record.target.workspaceId,
      );
      if (!workspace) updated = addWorkspace(updated, registrationOf(record));
      else if (
        workspace.root !== record.target.workspaceRoot ||
        workspace.instanceId !== record.target.instanceId
      ) {
        throw recovery('Concurrent workspace registration disagrees with creation intent.');
      }
    }
    const binding = updated.specBindings.find((item) => item.specId === record.specId);
    if (!binding) updated = bindSpecToWorkspace(updated, record.specId, record.target.workspaceId);
    else if (binding.workspaceId !== record.target.workspaceId) {
      throw recovery('Concurrent Spec binding differs from creation intent.');
    }
    return updated;
  });
}

function recovery(message: string): CreateOperationError {
  return new CreateOperationError('CREATE_RECOVERY_REQUIRED', message);
}
