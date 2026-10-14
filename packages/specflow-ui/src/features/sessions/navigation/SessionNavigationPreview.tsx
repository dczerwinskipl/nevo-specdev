import type { ReactNode } from 'react';
import { Circle, MessageCircleWarning } from 'lucide-react';
import { Icon, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { SessionNavigationEntry } from './summary';
/** Sessions owns the conservative state copy and presentation of provided titles. */
export function SessionNavigationPreview({
  entries,
  children,
}: {
  entries: readonly SessionNavigationEntry[];
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="px-2 py-2" data-session-navigation-preview>
      {entries.map((session) => {
        const attention = session.activityCode === 'attention';
        const tone = attention ? 'text-status-attention' : 'text-status-info';
        return (
          <div
            key={session.id}
            className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-2 py-1.5"
            data-session-navigation-entry
          >
            <Icon
              name={attention ? MessageCircleWarning : Circle}
              size="sm"
              className={`mt-[3px] size-3.5 ${tone}`}
            />
            <div>
              <Typography
                as="span"
                variant="body-md"
                className="block text-content-primary [overflow-wrap:anywhere]"
              >
                {session.title}
              </Typography>
              <Typography as="span" variant="body-sm" className={`mt-0.5 block ${tone}`}>
                {t(
                  attention
                    ? 'applicationNavigation.needsAttention'
                    : 'applicationNavigation.active',
                )}
              </Typography>
            </div>
          </div>
        );
      })}
      <div className="ml-[22px]">{children}</div>
    </div>
  );
}
