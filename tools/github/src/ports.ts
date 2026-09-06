export interface RulesetSummary {
  readonly id: number;
  readonly name: string;
}

/** The GitHub admin surface the reconciler needs. Implemented over the `gh` CLI. */
export interface GitHubAdminClient {
  /** Throws if `gh` is not installed / authenticated. */
  requireAuth(): void;
  /** `owner/repo` for the current checkout. */
  detectRepo(): string;
  getRepo(repo: string): Record<string, unknown>;
  patchRepo(repo: string, body: Record<string, unknown>): void;
  /**
   * Collaborators with their permission bits. Throws on any transport/permission
   * failure — the caller turns that into `{ ok: false }`, never "zero reviewers".
   */
  listCollaborators(repo: string): { login: string; permissions?: Record<string, boolean> }[];
  listRulesets(repo: string): RulesetSummary[];
  getRuleset(repo: string, id: number): Record<string, unknown>;
  createRuleset(repo: string, body: unknown): { id: number };
  updateRuleset(repo: string, id: number, body: unknown): void;
}

export type Logger = (line: string) => void;
