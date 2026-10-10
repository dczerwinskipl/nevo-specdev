import type { TFunction } from 'i18next';
import type { SessionSummary } from './model';

const SESSION_STATUS_KEYS = {
  active: 'specification.sessionStatusActive',
  attention: 'specification.sessionStatusAttention',
} as const;

export function sessionActivityLabel(session: SessionSummary, t: TFunction): string {
  return session.activityCode
    ? t(SESSION_STATUS_KEYS[session.activityCode])
    : (session.activity?.label ?? '');
}
