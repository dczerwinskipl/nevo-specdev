import type { SpecFlowEngine } from '../application';
import { createGitWorktreePort } from './worktrees/git-adapter';
import type { WorktreePort } from './worktrees/port';

/** Engine-internal composition only; never exported from src/index.ts. */
export interface VersionControl {
  readonly worktrees: WorktreePort;
}

export function openVersionControl(engine: SpecFlowEngine): VersionControl {
  return { worktrees: createGitWorktreePort(engine) };
}
