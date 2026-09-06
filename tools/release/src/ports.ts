// Explicit boundaries between the application logic and the outside world.
// Application/domain code depends only on these interfaces — never on
// child_process, `gh`, `git`, or `process` directly.

import type { NormalizedCheckRun } from './domain/release-plan.js';
import type { VersionFile } from './domain/version.js';

export interface GitClient {
  /** `git fetch origin --prune --tags`. */
  fetch(): Promise<void>;
  currentBranch(): Promise<string>;
  headSha(): Promise<string>;
  /** `git rev-parse <ref>^{commit}` — `null` when the ref does not resolve. */
  resolveCommit(ref: string): Promise<string | null>;
  /** Parent commit SHAs of `<ref>`, or `null` when the ref does not resolve. */
  commitParents(ref: string): Promise<string[] | null>;
  /** Repo-relative paths that differ between two refs (`git diff --name-only`). */
  changedFiles(fromRef: string, toRef: string): Promise<string[]>;
  /** File content at a ref, or `null` when the ref/path does not exist. */
  showFileAtRef(ref: string, path: string): Promise<string | null>;
  listTags(): Promise<string[]>;
  /** The commit a tag points at, or `null` when the tag does not exist. */
  tagCommit(tag: string): Promise<string | null>;
  createAnnotatedTag(input: { tag: string; sha: string; message: string }): Promise<void>;
  pushTag(tag: string): Promise<void>;
  remoteBranchExists(branch: string): Promise<boolean>;
  /**
   * `git merge-base --is-ancestor <candidate> <ref>` — is `candidate` reachable
   * from `ref`? Throws on an error that is neither "ancestor" nor "not ancestor".
   */
  isAncestor(candidate: string, ref: string): Promise<boolean>;
  /**
   * Build a commit that is `baseRef` with a single file replaced, using git
   * plumbing — the working tree and HEAD are never touched. Returns the new
   * commit SHA.
   */
  commitSingleFileOnto(input: {
    baseRef: string;
    path: string;
    content: string;
    message: string;
  }): Promise<string>;
  pushCommitToBranch(input: { sha: string; branch: string }): Promise<void>;
}

export interface PullRequestRef {
  readonly url: string;
}

export interface GitHubClient {
  /**
   * Latest check-runs for `sha`. Throws when GitHub could not be read or the
   * response could not be parsed — never returns an empty list to mean "failed".
   */
  checkRunsForCommit(sha: string): Promise<NormalizedCheckRun[]>;
  /**
   * `true` only on a **confirmed** existing Release, `false` only on a
   * **confirmed** absent one. Throws when the state could not be determined
   * (auth / network / permission / malformed) — the caller fails closed.
   */
  releaseExists(tag: string): Promise<boolean>;
  createRelease(input: { tag: string; prerelease: boolean }): Promise<{ url: string }>;
  /** The one open PR for `head` -> `base`, or `null`. Throws on a query failure. */
  findOpenPullRequest(input: { head: string; base: string }): Promise<PullRequestRef | null>;
  createPullRequest(input: {
    head: string;
    base: string;
    title: string;
    body: string;
  }): Promise<PullRequestRef>;
  /**
   * Request auto-merge (squash) for a PR. `enabled` on success; `unavailable`
   * only for the expected case where the repository does not have auto-merge
   * turned on (the PR then just waits for a normal merge). Any other failure —
   * auth, permission, network, unexpected — **throws**.
   */
  enableAutoMerge(prUrl: string): Promise<AutoMergeResult>;
}

export type AutoMergeResult =
  { readonly outcome: 'enabled' } | { readonly outcome: 'unavailable'; readonly reason: string };

/** Read the working-tree `version.json` (repo root). */
export type ReadWorkingVersion = () => VersionFile;

/** Line sink for human-facing progress output. */
export type Logger = (line: string) => void;
