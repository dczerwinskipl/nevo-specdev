import { Button, Icon, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { useWorkspaceRuntime } from '../WorkspaceContext';

export function PreparationSection() {
  const { t } = useTranslation();
  const runtime = useWorkspaceRuntime();

  return (
    <section
      aria-labelledby="preparation-heading"
      className="rounded-control border-l-2 border-primary bg-primary/5 p-4"
    >
      <div className="flex items-center gap-2 text-accent-primary">
        <span className="flex size-4 shrink-0 items-center justify-center">
          <Icon name="chat" size="sm" />
        </span>
        <Typography
          as="h3"
          variant="section-label"
          id="preparation-heading"
          className="font-semibold text-content-primary"
        >
          {t('specification.prepareSpecificationHeading')}
        </Typography>
      </div>
      <Typography variant="body-sm" className="mt-2 text-content-secondary">
        {t('specification.prepareSpecificationDescription')}
      </Typography>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button
          leadingIcon="chat"
          disabled={!runtime.canStartConversation}
          title={!runtime.canStartConversation ? t('common.notImplemented') : undefined}
          onClick={() => runtime.startConversation()}
        >
          {t('specification.startConversation')}
        </Button>
        <button
          type="button"
          onClick={runtime.openHistory}
          className="text-body-xs font-medium text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring lg:hidden"
        >
          {t('specification.activityHistoryLink')}
        </button>
      </div>
    </section>
  );
}
