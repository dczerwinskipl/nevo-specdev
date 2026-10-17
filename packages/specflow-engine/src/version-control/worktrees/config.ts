import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';

import type { ResolvedProjectHome } from '../../project/project-home';
import { GitCapabilityError } from '../../git/errors';
import { parseGitWorktreePolicy, type GitWorktreePolicy } from './policy';

/** Reads only home-owned committed and local configuration. */
export async function loadGitWorktreePolicy(
  context: ResolvedProjectHome,
): Promise<GitWorktreePolicy> {
  return (await readProjectGitPolicy(context)).policy;
}

/** One committed Project Home authority, including exact bytes pinned by lifecycle. */
export async function readProjectGitPolicy(
  context: ResolvedProjectHome,
): Promise<{ readonly policy: GitWorktreePolicy; readonly revision: string }> {
  const raw = await readVerifiedConfig(context.project.projectConfigPath);
  const project = parseConfig(raw);
  const local = await readYaml(context.project.localConfigPath, true);
  return {
    policy: parseGitWorktreePolicy(project, local),
    revision: createHash('sha256').update(raw, 'utf8').digest('hex'),
  };
}

async function readYaml(path: string, optional: boolean): Promise<unknown> {
  try {
    return parseConfig(await readVerifiedConfig(path));
  } catch (error) {
    if (optional && isMissing(error)) return undefined;
    if (error instanceof GitCapabilityError) throw error;
    throw invalid('Project Home configuration is unavailable or invalid.');
  }
}

async function readVerifiedConfig(path: string): Promise<string> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw invalid('Redirected configuration file.');
  return readFile(path, 'utf8');
}

function parseConfig(raw: string): unknown {
  const parsed = parseYaml(raw) as unknown;
  if (!isRecord(parsed)) throw invalid('Configuration must be a YAML object.');
  return parsed;
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
