import type { ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import { Icon, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
export function SpecificationStandaloneBack({
  overviewHref,
  renderBackLink,
  onBack,
}: {
  overviewHref?: string;
  renderBackLink?: (children: ReactNode, className: string) => ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter({ warn: false });
  const { t } = useTranslation();
  if (
    router?.state.matches.some((match) => match.routeId.startsWith('/_app/')) ||
    !(overviewHref || renderBackLink || onBack)
  )
    return null;
  const content = (
    <>
      <Icon name="arrow-right" size="sm" className="rotate-180" />
      <span data-spec-back-label>{t('specification.backToSpecifications')}</span>
    </>
  );
  const className =
    'inline-flex items-center gap-1.5 text-content-secondary outline-none focus-visible:outline-2 focus-visible:outline-focus-ring';
  return (
    <Typography as="div" variant="body-sm" className="mb-6">
      {renderBackLink ? (
        renderBackLink(content, className)
      ) : overviewHref ? (
        <a
          href={overviewHref}
          className={className}
          onClick={
            onBack
              ? (event) => {
                  if (
                    event.button === 0 &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey
                  ) {
                    event.preventDefault();
                    onBack();
                  }
                }
              : undefined
          }
        >
          {content}
        </a>
      ) : (
        <button type="button" className={className} onClick={onBack}>
          {content}
        </button>
      )}
    </Typography>
  );
}
