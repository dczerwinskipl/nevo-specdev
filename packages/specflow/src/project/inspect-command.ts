import { bootstrapProjectHome, openSpecFlowEngine } from '@nevo/specflow-engine';
import { Command } from 'commander';

export interface ProjectInspectCommandContext {
  readonly cwd: string;
  readonly stdout: (line: string) => void;
}

/** Read-only offline diagnostic of the Engine's Project Home authority. */
export function createProjectInspectCommand(context: ProjectInspectCommandContext): Command {
  const project = new Command('project').description('Inspect the local SpecFlow project');
  project
    .command('inspect')
    .description('Inspect the Project Home and current registered Git worktree')
    .option('--project-root <path>', 'Require this absolute, verified Project Home')
    .option('--json', 'Print machine-readable project and workspace identity')
    .action(async (options: { projectRoot?: string; json?: boolean }) => {
      const engine = await openSpecFlowEngine({
        cwd: context.cwd,
        ...(options.projectRoot ? { projectRoot: options.projectRoot } : {}),
      });
      const { project } = engine.context;
      const result = {
        projectId: project.projectId,
        homeRoot: project.homeRoot,
        stateRoot: project.stateRoot,
        projectConfigPath: project.projectConfigPath,
        localConfigPath: project.localConfigPath,
        workspaceId: engine.workspace.workspaceId,
        workspaceRoot: engine.workspace.root,
        workspaceKind: engine.workspace.kind,
      };
      if (options.json) {
        context.stdout(JSON.stringify(result));
      } else {
        context.stdout('Project Home: ' + result.homeRoot);
        context.stdout('Project ID: ' + result.projectId);
        context.stdout('Workspace: ' + result.workspaceRoot + ' (' + result.workspaceId + ')');
        context.stdout('State: ' + result.stateRoot);
      }
    });
  project
    .command('bootstrap')
    .description('Explicitly designate the uninitialized primary checkout as Project Home')
    .action(async () => {
      const engine = await bootstrapProjectHome(context.cwd);
      context.stdout('Project Home initialized: ' + engine.context.project.homeRoot);
      context.stdout('Project ID: ' + engine.context.project.projectId);
    });
  return project;
}
