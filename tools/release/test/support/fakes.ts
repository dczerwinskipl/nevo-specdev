// In-memory GitClient / GitHubClient for application-level orchestration tests.
// No child processes, no real repository. These deliberately implement an async
// interface with synchronous bodies.
/* eslint-disable @typescript-eslint/require-await */

import type { NormalizedCheckRun } from '../../src/domain/release-plan.js';
import type { SyncGitReader } from '../../src/infra/git-sync.js';
import type { GitClient, GitHubClient, PullRequestRef } from '../../src/ports.js';

export interface FakeCommit {
  readonly sha: string;
  readonly parents: string[];
  /** full file set of this commit's tree, path -> content. */
  readonly files: Record<string, string>;
}

export interface FakeGitState {
  currentBranch: string;
  headSha: string;
  /** every commit by sha. */
  commits: Map<string, FakeCommit>;
  /** ref name (`origin/main`, `release/v1.3`, HEAD~1, …) -> commit sha. */
  refs: Map<string, string>;
  /** tag name -> commit sha. */
  tags: Map<string, string>;
  remoteBranches: Set<string>;
  nextSha: number;
}

export interface FakeGit extends GitClient {
  readonly state: FakeGitState;
  readonly pushedBranches: { sha: string; branch: string }[];
  readonly createdTags: { tag: string; sha: string }[];
  readonly fetched: { count: number };
  /** helper: add a commit and return its sha. */
  addCommit(input: { parents?: string[]; files: Record<string, string> }): string;
}

const pad = (n: number): string => `commit${String(n).padStart(34, '0')}`;

export function createFakeGit(overrides: Partial<FakeGitState> = {}): FakeGit {
  const state: FakeGitState = {
    currentBranch: 'release/v1.3',
    headSha: 'head000000000000000000000000000000000000',
    commits: new Map(),
    refs: new Map(),
    tags: new Map(),
    remoteBranches: new Set(),
    nextSha: 1,
    ...overrides,
  };
  const pushedBranches: { sha: string; branch: string }[] = [];
  const createdTags: { tag: string; sha: string }[] = [];
  const fetched = { count: 0 };

  const shaOf = (ref: string): string | null => {
    if (state.commits.has(ref)) return ref;
    return state.refs.get(ref) ?? state.tags.get(ref) ?? null;
  };
  const commitOf = (ref: string): FakeCommit | null => {
    const sha = shaOf(ref);
    return sha ? (state.commits.get(sha) ?? null) : null;
  };

  const addCommit = ({
    parents = [],
    files,
  }: {
    parents?: string[];
    files: Record<string, string>;
  }): string => {
    const sha = pad(state.nextSha++);
    state.commits.set(sha, { sha, parents, files: { ...files } });
    return sha;
  };

  return {
    state,
    pushedBranches,
    createdTags,
    fetched,
    addCommit,

    fetch: async () => {
      fetched.count += 1;
    },
    currentBranch: async () => state.currentBranch,
    headSha: async () => state.headSha,
    resolveCommit: async (ref) => shaOf(ref),
    commitParents: async (ref) => commitOf(ref)?.parents.slice() ?? null,
    changedFiles: async (fromRef, toRef) => {
      const a = commitOf(fromRef)?.files ?? {};
      const b = commitOf(toRef)?.files ?? {};
      const paths = new Set([...Object.keys(a), ...Object.keys(b)]);
      return [...paths].filter((p) => a[p] !== b[p]).sort();
    },
    showFileAtRef: async (ref, path) => commitOf(ref)?.files[path] ?? null,
    listTags: async () => [...state.tags.keys()],
    tagCommit: async (tag) => state.tags.get(tag) ?? null,
    createAnnotatedTag: async ({ tag, sha }) => {
      state.tags.set(tag, sha);
      createdTags.push({ tag, sha });
    },
    pushTag: async () => undefined,
    remoteBranchExists: async (branch) => state.remoteBranches.has(branch),
    isAncestor: async (candidate, ref) => {
      const target = shaOf(candidate);
      const start = shaOf(ref);
      if (!target || !start) return false;
      const seen = new Set<string>();
      const queue = [start];
      while (queue.length) {
        const sha = queue.shift();
        if (sha === undefined || seen.has(sha)) continue;
        seen.add(sha);
        if (sha === target) return true;
        for (const p of state.commits.get(sha)?.parents ?? []) queue.push(p);
      }
      return false;
    },
    commitSingleFileOnto: async ({ baseRef, path, content, message }) => {
      const base = commitOf(baseRef);
      const sha = addCommit({
        parents: base ? [base.sha] : [],
        files: { ...(base?.files ?? {}), [path]: content },
      });
      void message;
      return sha;
    },
    pushCommitToBranch: async ({ sha, branch }) => {
      pushedBranches.push({ sha, branch });
      state.remoteBranches.add(branch);
      state.refs.set(`origin/${branch}`, sha);
    },
  };
}

/** Seed a single base commit and point `refs` at it. Returns its sha. */
export function seedBranch(
  git: FakeGit,
  ref: string,
  files: Record<string, string>,
  parents: string[] = [],
): string {
  const sha = git.addCommit({ parents, files });
  git.state.refs.set(ref, sha);
  return sha;
}

export interface FakeGitHubState {
  checkRuns: NormalizedCheckRun[];
  releases: Set<string>;
  openPrs: { head: string; base: string; url: string }[];
  /** when set, releaseExists / findOpenPullRequest / checkRunsForCommit throw it. */
  failReleaseView?: Error;
  failPrList?: Error;
  failCheckRuns?: Error;
  /** 'ok' -> enabled; 'unavailable' -> the expected non-fatal case; Error -> thrown. */
  autoMerge: 'ok' | 'unavailable' | Error;
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
    autoMerge: 'ok',
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
    checkRunsForCommit: async () => {
      if (state.failCheckRuns) throw state.failCheckRuns;
      return state.checkRuns;
    },
    releaseExists: async (tag) => {
      if (state.failReleaseView) throw state.failReleaseView;
      return state.releases.has(tag);
    },
    createRelease: async ({ tag }) => {
      state.releases.add(tag);
      createdReleases.push(tag);
      return { url: `https://example.test/releases/${tag}` };
    },
    findOpenPullRequest: async ({ head, base }): Promise<PullRequestRef | null> => {
      if (state.failPrList) throw state.failPrList;
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
      if (state.autoMerge instanceof Error) throw state.autoMerge;
      autoMerged.push(prUrl);
      return state.autoMerge === 'unavailable'
        ? { outcome: 'unavailable', reason: 'the repository does not have auto-merge enabled' }
        : { outcome: 'enabled' };
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
