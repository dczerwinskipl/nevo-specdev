import { GitCapabilityError } from '../../git/errors';

const COMMIT = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/iu;
const LOCAL_BRANCH = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u;

/** Pure conservative subset, followed by Git check-ref-format inside the adapter. */
export function validateBranchName(branch: string): void {
  if (
    branch.length < 1 ||
    branch.length > 240 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/u.test(branch) ||
    branch.startsWith('-') ||
    branch.includes('//') ||
    branch.includes('..') ||
    branch.endsWith('/') ||
    branch.endsWith('.') ||
    branch.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock'))
  ) {
    throw invalid('Invalid or unsafe Git branch name.');
  }
}

/** HEAD is relative to Project Home; simple names designate local branches, never remotes. */
export function validateBaseRef(baseRef: string): void {
  if (
    baseRef === 'HEAD' ||
    COMMIT.test(baseRef) ||
    /^refs\/(?:heads|tags)\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/u.test(baseRef)
  ) {
    if (baseRef.startsWith('refs/')) validateBranchName(baseRef.slice(baseRef.indexOf('/', 5) + 1));
    return;
  }
  if (!LOCAL_BRANCH.test(baseRef) || baseRef.includes('..') || baseRef.endsWith('.lock')) {
    throw invalid('Unsupported Git worktree base ref.');
  }
}

export function normalizeBaseRef(baseRef: string): string {
  validateBaseRef(baseRef);
  return baseRef === 'HEAD' || COMMIT.test(baseRef) || baseRef.startsWith('refs/')
    ? baseRef
    : 'refs/heads/' + baseRef;
}

function invalid(message: string): GitCapabilityError {
  return new GitCapabilityError('GIT_POLICY_INVALID', message);
}
