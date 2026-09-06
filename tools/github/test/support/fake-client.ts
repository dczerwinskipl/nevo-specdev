import type { GitHubAdminClient, RulesetSummary } from '../../src/ports.js';

export interface FakeClientState {
  repo: string;
  collaborators: { login: string; permissions?: Record<string, boolean> }[] | Error;
  repoSettings: Record<string, unknown>;
  rulesets: Map<number, Record<string, unknown>>;
}

export interface FakeAdminClient extends GitHubAdminClient {
  readonly state: FakeClientState;
  readonly patched: Record<string, unknown>[];
  readonly createdRulesets: unknown[];
  readonly updatedRulesets: { id: number; body: unknown }[];
}

export function createFakeAdminClient(overrides: Partial<FakeClientState> = {}): FakeAdminClient {
  const state: FakeClientState = {
    repo: 'acme/widget',
    collaborators: [{ login: 'owner', permissions: { admin: true } }],
    repoSettings: {},
    rulesets: new Map(),
    ...overrides,
  };
  const patched: Record<string, unknown>[] = [];
  const createdRulesets: unknown[] = [];
  const updatedRulesets: { id: number; body: unknown }[] = [];
  let nextId = 1;

  return {
    state,
    patched,
    createdRulesets,
    updatedRulesets,
    requireAuth: () => undefined,
    detectRepo: () => state.repo,
    getRepo: () => ({ ...state.repoSettings }),
    patchRepo: (_repo, body) => {
      patched.push(body);
      Object.assign(state.repoSettings, body);
    },
    listCollaborators: () => {
      if (state.collaborators instanceof Error) throw state.collaborators;
      return state.collaborators;
    },
    listRulesets: (): RulesetSummary[] =>
      [...state.rulesets.entries()].map(([id, rs]) => ({ id, name: String(rs.name) })),
    getRuleset: (_repo, id) => state.rulesets.get(id) ?? {},
    createRuleset: (_repo, body) => {
      const id = nextId++;
      createdRulesets.push(body);
      state.rulesets.set(id, { ...(body as Record<string, unknown>) });
      return { id };
    },
    updateRuleset: (_repo, id, body) => {
      updatedRulesets.push({ id, body });
      state.rulesets.set(id, { ...(body as Record<string, unknown>) });
    },
  };
}
