import { lstat, readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';

import type { ResolvedProjectHome } from '../../project/project-home';
import { GitCapabilityError } from '../../git/errors';
import { parseGitWorktreePolicy, type GitWorktreePolicy } from './policy';

/** Reads only home-owned committed and local configuration. */
export async function loadGitWorktreePolicy(
  context: ResolvedProjectHome,
): Promise<GitWorktreePolicy> {
  const project = await readYaml(context.project.projectConfigPath, false);
  const local = await readYaml(context.project.localConfigPath, true);
  return parseGitWorktreePolicy(project, local);
}

async function readYaml(path: string, optional: boolean): Promise<unknown> {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw invalid('Redirected configuration file.');
    const parsed = parseYaml(await readFile(path, 'utf8')) as unknown;
    if (!isRecord(parsed)) throw invalid('Configuration must be a YAML object.');
    return parsed;
  } catch (error) {
    if (optional && isMissing(error)) return undefined;
    if (error instanceof GitCapabilityError) throw error;
    throw invalid('Project Home configuration is unavailable or invalid.');
  }
}

function invalid(message: string): GitCapabilityError {
  return new GitCapabilityError('GIT_POLICY_INVALID', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissing(value: unknown): boolean {
  return isRecord(value) && value.code === 'ENOENT';
}
