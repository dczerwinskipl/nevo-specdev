// In-memory GitClient / GitHubClient for application-level orchestration tests.
// No child processes, no real repository. These deliberately implement an async
// interface with synchronous bodies.
/* eslint-disable @typescript-eslint/require-await */

import type { NormalizedCheckRun } from '../../src/domain/release-plan.js';
import type { GitClient, GitHubClient, PullRequestRef } from '../../src/ports.js';
import type { SyncGitReader } from '../../src/infra/git-sync.js';

export interface FakeGitState {
  currentBranch: string;
  headSha: string;
  /** ref -> commit sha (for resolveCommit). */
  commits: Map<string, string>;
  /** "<ref>:<path>" -> content. */
  files: Map<string, string>;
  tags: Map<string, string>; // tag -> commit sha
  remoteBranches: Set<string>;
  /** next synthetic sha for commitSingleFileOnto. */
  nextSha: number;
}

export interface FakeGit extends GitClient {
  readonly state: FakeGitState;
  readonly pushedBranches: { sha: string; branch: string }[];
  readonly createdTags: { tag: string; sha: string }[];
  readonly fetched: { count: number };
}

export function createFakeGit(overrides: Partial<FakeGitState> = {}): FakeGit {
  const state: FakeGitState = {
    currentBranch: 'release/v1.3',
    headSha: 'head000000000000000000000000000000000000',
    commits: new Map(),
    files: new Map(),
    tags: new Map(),
    remoteBranches: new Set(),
    nextSha: 1,
    ...overrides,
  };
  const pushedBranches: { sha: string; branch: string }[] = [];
  const createdTags: { tag: string; sha: string }[] = [];
  const fetched = { count: 0 };

  return {
    state,
    pushedBranches,
    createdTags,
    fetched,
    fetch: async () => {
      fetched.count += 1;
    },
    currentBranch: async () => state.currentBranch,
    headSha: async () => state.headSha,
    resolveCommit: async (ref) => state.commits.get(ref) ?? null,
    showFileAtRef: async (ref, path) => state.files.get(`${ref}:${path}`) ?? null,
    listTags: async () => [...state.tags.keys()],
    tagCommit: async (tag) => state.tags.get(tag) ?? null,
    createAnnotatedTag: async ({ tag, sha }) => {
      state.tags.set(tag, sha);
      createdTags.push({ tag, sha });
    },
    pushTag: async () => undefined,
    remoteBranchExists: async (branch) => state.remoteBranches.has(branch),
    commitSingleFileOnto: async ({ baseRef, path, content }) => {
      const sha = `commit${String(state.nextSha++).padStart(34, '0')}`;
      state.commits.set(sha, sha);
      state.files.set(`${sha}:${path}`, content);
      void baseRef;
      return sha;
    },
    pushCommitToBranch: async ({ sha, branch }) => {
      pushedBranches.push({ sha, branch });
      state.remoteBranches.add(branch);
      state.commits.set(`origin/${branch}`, sha);
    },
  };
}

export interface FakeGitHubState {
  checkRuns: NormalizedCheckRun[];
  releases: Set<string>;
  openPrs: { head: string; base: string; url: string }[];
}

export interface FakeGitHub extends GitHubClient {
  readonly state: FakeGitHubState;
  readonly createdReleases: string[];
  readonly createdPrs: { head: string; base: string; url: string }[];
  readonly autoMerged: string[];
}

export function createFakeGitHub(overrides: Partial<FakeGitHubState> = {}): FakeGitHub {
  const state: FakeGitHubState = {
    checkRuns: greenChecks(),
    releases: new Set(),
    openPrs: [],
    ...overrides,
  };
  const createdReleases: string[] = [];
  const createdPrs: { head: string; base: string; url: string }[] = [];
  const autoMerged: string[] = [];
  let prCounter = 100;

  return {
    state,
    createdReleases,
    createdPrs,
    autoMerged,
    checkRunsForCommit: async () => state.checkRuns,
    releaseExists: async (tag) => state.releases.has(tag),
    createRelease: async ({ tag }) => {
      state.releases.add(tag);
      createdReleases.push(tag);
      return { url: `https://example.test/releases/${tag}` };
    },
    findOpenPullRequest: async ({ head, base }): Promise<PullRequestRef | null> => {
      const pr = state.openPrs.find((p) => p.head === head && p.base === base);
      return pr ? { url: pr.url } : null;
    },
    createPullRequest: async ({ head, base }): Promise<PullRequestRef> => {
      const url = `https://example.test/pull/${String(prCounter++)}`;
      state.openPrs.push({ head, base, url });
      createdPrs.push({ head, base, url });
      return { url };
    },
    enableAutoMerge: async (prUrl) => {
      autoMerged.push(prUrl);
    },
  };
}

export function greenChecks(): NormalizedCheckRun[] {
  return [
    { name: 'quality', status: 'completed', conclusion: 'success', id: 1 },
    { name: 'test', status: 'completed', conclusion: 'success', id: 2 },
    { name: 'build', status: 'completed', conclusion: 'success', id: 3 },
  ];
}

export function createFakeSyncGit(
  files: Record<string, string> = {},
  refs: string[] = [],
): SyncGitReader {
  const known = new Set(refs);
  return {
    refExists: (ref) => known.has(ref),
    readFileAtRef: (ref, path) => files[`${ref}:${path}`] ?? null,
  };
}
