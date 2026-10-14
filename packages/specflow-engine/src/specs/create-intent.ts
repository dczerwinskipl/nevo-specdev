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
  const target: ClientCreateTarget =
    input.target.kind === 'existing'
      ? { kind: 'existing', workspaceId: input.target.workspaceId }
      : {
          kind: 'new-worktree',
          baseRef:
            input.target.baseRef === undefined
              ? { kind: 'omitted' }
              : { kind: 'explicit', value: input.target.baseRef },
          branch:
            input.target.branch === undefined
              ? { kind: 'omitted' }
              : { kind: 'explicit', value: input.target.branch },
        };
  return { title, ...(goal ? { goal } : {}), target };
}

export function fingerprintCreateClientIntent(intent: CreateClientIntent): string {
  return createHash('sha256').update(JSON.stringify(intent), 'utf8').digest('hex');
}
