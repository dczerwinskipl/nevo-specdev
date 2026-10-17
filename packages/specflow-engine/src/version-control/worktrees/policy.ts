import { GitCapabilityError } from '../../git/errors';
import { validateBaseRef, validateBranchName } from '../git/refs';

export { validateBaseRef, validateBranchName, normalizeBaseRef } from '../git/refs';

/** Project Home is the only authority for operational Git policy. */
export interface GitWorktreePolicy {
  readonly enabled: boolean;
  readonly branchPattern: string;
  readonly baseRef: string;
  /** Independently configured destination for existing-worktree integration. */
  readonly integrationTargetBranch?: string;
}

export const DEFAULT_BRANCH_PATTERN = 'spec/{slug}-{shortId}';
export const DEFAULT_BASE_REF = 'HEAD';

const SUPPORTED_TEMPLATE_FIELDS = ['slug', 'shortId'] as const;

/** Pure parser. Call with Project Home config, never the linked checkout config. */
export function parseGitWorktreePolicy(
  projectConfig: unknown,
  localConfig?: unknown,
): GitWorktreePolicy {
  if (!isRecord(projectConfig)) throw invalid('Project configuration must be an object.');
  if (isRecord(localConfig) && localConfig.git !== undefined) {
    throw invalid('Git policy cannot be overridden by workstation-local configuration.');
  }

  const value = projectConfig.git;
  if (value === undefined) {
    return { enabled: false, branchPattern: DEFAULT_BRANCH_PATTERN, baseRef: DEFAULT_BASE_REF };
  }
  if (!isRecord(value) || typeof value.enabled !== 'boolean') {
    throw invalid('Project git.enabled must be a boolean.');
  }
  if (Object.keys(value).some((key) => key !== 'enabled' && key !== 'worktrees' && key !== 'integrationTargetBranch')) {
    throw invalid('Unsupported Git policy key.');
  }
  const worktrees = value.worktrees;
  if (worktrees !== undefined && !isRecord(worktrees)) {
    throw invalid('git.worktrees must be an object.');
  }
  if (
    worktrees !== undefined &&
    Object.keys(worktrees).some((key) => key !== 'branchPattern' && key !== 'baseRef')
  ) {
    throw invalid('Unsupported git.worktrees policy key.');
  }
  const branchPattern = worktrees?.branchPattern ?? DEFAULT_BRANCH_PATTERN;
  const baseRef = worktrees?.baseRef ?? DEFAULT_BASE_REF;
  if (typeof branchPattern !== 'string' || typeof baseRef !== 'string') {
    throw invalid('Git worktree policy values must be strings.');
  }
  validateBranchPattern(branchPattern);
  validateBaseRef(baseRef);
  const target = value.integrationTargetBranch;
  if (target !== undefined) {
    if (typeof target !== 'string') throw invalid('git.integrationTargetBranch must be a local branch.');
    validateBranchName(target);
    if (target === 'HEAD') throw invalid('Integration target must be a named local branch.');
  }
  return {
    enabled: value.enabled,
    branchPattern,
    baseRef,
    ...(target !== undefined ? { integrationTargetBranch: target } : {}),
  };
}

/** Only two placeholders are supported; a stable shortId is mandatory. */
export function validateBranchPattern(pattern: string): void {
  if (!pattern || pattern.length > 200) throw invalid('Invalid Git worktree branch pattern.');
  const tokens = [...pattern.matchAll(/\{([^{}]*)\}/gu)].map((match) => match[1]);
  if (
    tokens.some((token) => !SUPPORTED_TEMPLATE_FIELDS.some((field) => field === token)) ||
    tokens.filter((token) => token === 'shortId').length !== 1 ||
    tokens.filter((token) => token === 'slug').length > 1
  ) {
    throw invalid('Branch pattern requires one {shortId}; only {slug} is also supported.');
  }
  // Detect unmatched braces and hidden template expressions.
  const withoutTokens = pattern.replace(/\{(?:slug|shortId)\}/gu, '');
  if (/[{}]/u.test(withoutTokens)) throw invalid('Malformed Git branch template.');
  validateBranchName(pattern.replaceAll('{slug}', 'example').replaceAll('{shortId}', '12345678'));
}

export function resolveWorktreeBranch(
  policy: GitWorktreePolicy,
  slug: string,
  shortId: string,
  override?: string,
): string {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(slug) || !/^[a-f0-9]{8}$/iu.test(shortId)) {
    throw invalid('Invalid worktree naming token.');
  }
  const branch =
    override ?? policy.branchPattern.replaceAll('{slug}', slug).replaceAll('{shortId}', shortId);
  validateBranchName(branch);
  return branch;
}

function invalid(message: string): GitCapabilityError {
  return new GitCapabilityError('GIT_POLICY_INVALID', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
