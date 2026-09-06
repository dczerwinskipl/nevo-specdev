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
  /** File content at a ref, or `null` when the ref/path does not exist. */
  showFileAtRef(ref: string, path: string): Promise<string | null>;
  listTags(): Promise<string[]>;
  /** The commit a tag points at, or `null` when the tag does not exist. */
  tagCommit(tag: string): Promise<string | null>;
  createAnnotatedTag(input: { tag: string; sha: string; message: string }): Promise<void>;
  pushTag(tag: string): Promise<void>;
  remoteBranchExists(branch: string): Promise<boolean>;
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
  checkRunsForCommit(sha: string): Promise<NormalizedCheckRun[]>;
  releaseExists(tag: string): Promise<boolean>;
  createRelease(input: { tag: string; prerelease: boolean }): Promise<{ url: string }>;
  findOpenPullRequest(input: { head: string; base: string }): Promise<PullRequestRef | null>;
  createPullRequest(input: {
    head: string;
    base: string;
    title: string;
    body: string;
  }): Promise<PullRequestRef>;
  /** Best-effort; a failure here is not fatal to the caller. */
  enableAutoMerge(prUrl: string): Promise<void>;
}

/** Read the working-tree `version.json` (repo root). */
export type ReadWorkingVersion = () => VersionFile;

/** Line sink for human-facing progress output. */
export type Logger = (line: string) => void;
