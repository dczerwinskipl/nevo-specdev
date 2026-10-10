export type {
  ActivityEvent,
  ActivityEventKind,
  BaseActivityEvent,
  DocumentActivityEvent,
  InformationalActivityEvent,
  SessionActivityEvent,
  TaskActivityEvent,
} from '../model';

import type { ActivityEvent } from '../model';

export type WorkspaceActivityEvent = ActivityEvent;

/**
 * Passes through typed ActivityEvent.
 */
export function normalizeActivityEvent(event: ActivityEvent): ActivityEvent {
  return event;
}
