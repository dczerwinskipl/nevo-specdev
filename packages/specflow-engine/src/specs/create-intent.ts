import { createHash } from 'node:crypto';

import { CreateOperationError } from './create-journal';

export type ClientOverride =
  { readonly kind: 'omitted' } | { readonly kind: 'explicit'; readonly value: string };

export type ClientCreateTarget =
  | { readonly kind: 'existing'; readonly workspaceId: string }
  | {
      readonly kind: 'new-worktree';
      readonly baseRef: ClientOverride;
      readonly branch: ClientOverride;
    };

/**
 * Canonical client intent; generated dates and currently configured Git defaults
 * are deliberately absent. Transport adapters preserve omission vs explicitness.
 */
export interface CreateClientIntent {
  readonly title: string;
  readonly goal?: string;
  readonly target: ClientCreateTarget;
}

export type CreateClientTargetInput =
  | { readonly kind: 'existing'; readonly workspaceId: string }
  | {
      readonly kind: 'new-worktree';
      readonly baseRef?: string;
      readonly branch?: string;
    };

export function normalizeCreateClientIntent(input: {
  readonly title: string;
  readonly goal?: string;
  readonly target: CreateClientTargetInput;
}): CreateClientIntent {
  const title = input.title.replace(/\s+/gu, ' ').trim();
  const goal = input.goal?.trim();
  if (!title || title.length > 200) {
    throw new CreateOperationError('CREATE_OPERATION_INVALID', 'Invalid specification title.');
  }
  const target = normalizeClientTarget(input.target);
  return { title, ...(goal ? { goal } : {}), target };
}

export function fingerprintCreateClientIntent(intent: CreateClientIntent): string {
  return createHash('sha256').update(JSON.stringify(intent), 'utf8').digest('hex');
}

function normalizeClientTarget(input: CreateClientTargetInput): ClientCreateTarget {
  switch (input.kind) {
    case 'existing':
      return { kind: 'existing', workspaceId: input.workspaceId };
    case 'new-worktree':
      return {
        kind: 'new-worktree',
        baseRef: normalizeOverride(input.baseRef),
        branch: normalizeOverride(input.branch),
      };
    default: {
      const exhaustive: never = input;
      return exhaustive;
    }
  }
}

function normalizeOverride(value: string | undefined): ClientOverride {
  if (value === undefined) return { kind: 'omitted' };
  return { kind: 'explicit', value };
}
