import {
  resolveProjectHome,
  type ResolveProjectHomeOptions,
  type ResolvedProjectHome,
} from './project/project-home';
import {
  WorkspaceRegistryError,
  readWorkspaceRegistry,
  verifyWorkspaceRoot,
  type WorkspaceRegistration,
  type WorkspaceRegistry,
} from './project/workspace-registry';

/** Offline application boundary shared by product CLI and Runtime. */
export interface SpecFlowEngine {
  readonly context: ResolvedProjectHome;
  readonly workspace: WorkspaceRegistration;
  readRegistry(): Promise<WorkspaceRegistry>;
}

/** Read-only admission: never initialize or replace Project Home state implicitly. */
export async function openSpecFlowEngine(
  options: ResolveProjectHomeOptions,
): Promise<SpecFlowEngine> {
  const context = await resolveProjectHome(options);
  const registry = await readWorkspaceRegistry(context);
  const current = registry.workspaces.find((item) => item.root === context.workspace.root);
  if (!current) {
    throw new WorkspaceRegistryError(
      'REGISTRY_CONFLICT',
      'The current Git worktree is not registered with this Project Home.',
    );
  }
  await verifyWorkspaceRoot(context, current.root, current);
  const workspace = Object.freeze({ ...current });
  return {
    context,
    workspace,
    async readRegistry() {
      // Revalidate the physical checkout on each use, including linked
      // incarnation, rather than trusting the original open-time snapshot.
      const latest = await readWorkspaceRegistry(context);
      const registered = latest.workspaces.find(
        (item) => item.workspaceId === workspace.workspaceId && item.root === workspace.root,
      );
      if (!registered) {
        throw new WorkspaceRegistryError(
          'REGISTRY_CONFLICT',
          'The current workspace registration is no longer available.',
        );
      }
      await verifyWorkspaceRoot(context, registered.root, registered);
      return latest;
    },
  };
}
