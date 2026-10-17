/** Trusted Engine create input, distinct from the normalized client intent. */
export type CreateSpecificationTarget =
  | { readonly kind: 'existing'; readonly workspaceId: string }
  | {
      readonly kind: 'new-worktree';
      readonly baseRef: string;
      readonly branch?: string;
    };

export interface CreateSpecificationInput {
  readonly operationId: string;
  readonly title: string;
  readonly created: string;
  readonly goal?: string;
  readonly target: CreateSpecificationTarget;
}
