import type { IconName, StatusTone } from '@nevo/ui';

export interface WorkspaceMaterial {
  readonly id: string;
  readonly name: string;
  readonly reference?: string;
  readonly source: string;
  readonly content:
    | { readonly state: 'available'; readonly kind: 'markdown'; readonly markdown: string }
    | {
        readonly state: 'available';
        readonly kind: 'image';
        readonly src: string;
        readonly alt: string;
      }
    | { readonly state: 'available'; readonly kind: 'archive'; readonly href: string }
    | { readonly state: 'unavailable' | 'forbidden' };
}
export interface WorkspaceSession {
  readonly id: string;
  readonly title: string;
  /** Supplied by the owning session application, never derived from a task ID. */
  readonly href?: string;
  readonly provider: string;
  readonly providerId?: string;
  readonly role?: string;
  readonly current: boolean;
  readonly step: string;
  readonly attempt: number;
  readonly status: 'running' | 'idle' | 'waitingForUser';
  readonly question?: string;
}
export interface WorkspaceHandoff {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly attempt: number;
  readonly time?: string;
  readonly result?: { readonly label: string; readonly tone: StatusTone };
  readonly feedback?: string;
  readonly materials: readonly WorkspaceMaterial[];
}
export interface WorkspaceDecision {
  readonly id: string;
  readonly label: string;
  readonly consequence: string;
  readonly feedbackRequired: boolean;
}
/** Presentation facts supplied explicitly by the application or a development fixture. */
export interface TaskWorkspaceData {
  readonly id: string;
  readonly specification: string;
  readonly title: string;
  readonly description?: string;
  readonly document?: string;
  readonly status: { readonly label: string; readonly tone: StatusTone; readonly icon: IconName };
  readonly phase: 'draft' | 'ready' | 'waiting' | 'active' | 'human' | 'completed';
  readonly step?: {
    readonly name: string;
    readonly attempt?: number;
    readonly instruction?: string;
  };
  readonly startLabel?: string;
  readonly sessions: readonly WorkspaceSession[];
  readonly handoffs: readonly WorkspaceHandoff[];
  readonly decisions: readonly WorkspaceDecision[];
}
