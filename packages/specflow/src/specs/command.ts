import {
  createSpecificationFromRequest,
  discoverSpecifications,
  openSpecFlowEngine,
  resolveSpecification,
  type CreateSpecificationTarget,
  type DiscoveredSpecification,
  type SpecFlowEngine,
} from '@nevo/specflow-engine';
import { Command } from 'commander';

export interface SpecsCommandContext {
  readonly cwd: string;
  readonly stdout: (line: string) => void;
}

function summary(item: DiscoveredSpecification): Record<string, unknown> {
  if (item.status !== 'available') return item;
  return {
    status: item.status,
    specId: item.specId,
    workspaceId: item.workspaceId,
    workspaceRoot: item.workspaceRoot,
    binding: item.binding,
    specification: item.specification,
  };
}

function output(context: SpecsCommandContext, value: unknown): void {
  context.stdout(JSON.stringify(value));
}

/**
 * Offline capability adapter. This module has no dependency on Runtime or its
 * HTTP transport; all writes go through Engine's durable create use case.
 */
export function createSpecsCommand(context: SpecsCommandContext): Command {
  const specs = new Command('specs').description(
    'Create and inspect canonical local Specifications',
  );

  specs
    .command('create')
    .description('Create a Specification in the current checkout or a managed Git worktree')
    .requiredOption('--title <title>', 'Human-readable Specification title')
    .option('--goal <description>', 'Optional Specification goal')
    .option('--workspace-id <id>', 'Target an existing registered workspace ID')
    .option('--worktree', 'Provision a managed Git worktree')
    .option('--base-ref <ref>', 'Base Git ref for new worktree (default HEAD)')
    .option('--branch <branch>', 'Branch name for new worktree')
    .option('--operation-id <uuid>', 'Stable UUID for idempotent retries')
    .option('--project-root <path>', 'Require this verified Project Home root')
    .option('--json', 'Print canonical result as JSON')
    .action(
      async (options: {
        title: string;
        goal?: string;
        workspaceId?: string;
        worktree?: boolean;
        baseRef?: string;
        branch?: string;
        operationId?: string;
        projectRoot?: string;
        json?: boolean;
      }) => {
        validateCreateOptions(options);
        const engine = await engineAt(context.cwd, options.projectRoot);
        const result = await createSpecificationFromRequest(engine, {
          operationId: options.operationId,
          title: options.title,
          goal: options.goal,
          target: resolveCliCreateTarget(engine, options),
        });
        if (options.json) {
          output(context, result);
        } else {
          context.stdout('Created Specification: ' + result.slug + ' (' + result.specId + ')');
          context.stdout('Workspace: ' + result.workspaceRoot + ' (' + result.workspaceId + ')');
          context.stdout('Manifest: ' + result.relativeManifestPath);
          context.stdout('Operation ID: ' + result.operationId);
        }
      },
    );

  specs
    .command('list')
    .description('List canonical Specs, including unavailable bindings')
    .option('--json', 'Output structured JSON')
    .option('--project-root <path>', 'Require this verified Project Home root')
    .action(async (options: { json?: boolean; projectRoot?: string }) => {
      const engine = await engineAt(context.cwd, options.projectRoot);
      const found = await discoverSpecifications(engine);
      if (options.json) output(context, found.map(summary));
      else
        for (const item of found) {
          context.stdout(
            item.specId +
              ' ' +
              (item.status === 'available' ? item.specification.slug : item.status),
          );
        }
    });

  specs
    .command('resolve')
    .description('Resolve a canonical Spec ID and its verified source workspace')
    .argument('<spec-id>', 'Canonical specification UUID')
    .option('--json', 'Output structured JSON')
    .option('--project-root <path>', 'Require this verified Project Home root')
    .action(async (id: string, options: { json?: boolean; projectRoot?: string }) => {
      const item = await resolveSpecification(await engineAt(context.cwd, options.projectRoot), id);
      if (options.json) output(context, summary(item));
      else {
        context.stdout('Spec: ' + item.specId);
        context.stdout('Status: ' + item.status);
        context.stdout('Workspace: ' + item.workspaceId);
        if (item.status === 'available')
          context.stdout('Manifest: ' + item.specification.relativeManifestPath);
      }
    });
  return specs;
}

async function engineAt(cwd: string, projectRoot?: string): Promise<SpecFlowEngine> {
  return openSpecFlowEngine({
    cwd,
    ...(projectRoot ? { projectRoot } : {}),
  });
}

interface CliCreateOptions {
  readonly worktree?: boolean;
  readonly workspaceId?: string;
  readonly baseRef?: string;
  readonly branch?: string;
}

function validateCreateOptions(options: CliCreateOptions): void {
  if (options.worktree && options.workspaceId) {
    throw new Error('Choose either --worktree or --workspace-id.');
  }
  if (!options.worktree && (options.baseRef || options.branch)) {
    throw new Error('--base-ref and --branch require --worktree.');
  }
}

function resolveCliCreateTarget(
  engine: SpecFlowEngine,
  options: CliCreateOptions,
): CreateSpecificationTarget {
  if (options.worktree) {
    return {
      kind: 'new-worktree',
      baseRef: options.baseRef ?? 'HEAD',
      ...(options.branch ? { branch: options.branch } : {}),
    };
  }
  return { kind: 'existing', workspaceId: options.workspaceId ?? engine.workspace.workspaceId };
}
