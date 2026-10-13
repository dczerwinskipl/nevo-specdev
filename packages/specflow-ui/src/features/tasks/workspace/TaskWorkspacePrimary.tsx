import { Badge, Button, Icon, MarkdownDocument, Typography } from '@nevo/ui';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceSection } from '../../specs/workspace/sections/WorkspaceSection';
import { TaskWorkspaceMaterials } from './TaskWorkspaceMaterials';
import { TaskWorkspaceSessions } from './TaskWorkspaceSessions';
import { TaskWorkspaceDecision } from './TaskWorkspaceDecision';
import { useTaskWorkspace, useWorkspaceScroll } from './TaskWorkspaceState';
import { DocumentDescription } from '../../documents/description/DocumentDescription';

export function TaskWorkspacePrimary({
  onMaterial,
  onHistory,
  onBack,
}: {
  readonly onMaterial: (id: string) => void;
  readonly onHistory?: () => void;
  readonly onBack?: () => void;
}) {
  const { t } = useTranslation();
  const { data, description, setDescription, instruction, setInstruction, message, setMessage } =
    useTaskWorkspace();
  const instructionId = useId();
  const { ref } = useWorkspaceScroll('primary');
  const last = data.handoffs[0];
  return (
    <div ref={ref} className="grid min-w-0 gap-6 p-4 sm:p-6" data-task-workspace="primary">
      {onBack ? (
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={ArrowLeft}
          className="justify-self-start"
          onClick={onBack}
        >
          {t('navigation.back')}
        </Button>
      ) : null}
      <div className="grid min-w-0 gap-3">
        <Typography
          as="h1"
          variant="title-lg"
          className="outline-none [overflow-wrap:anywhere]"
          tabIndex={-1}
        >
          {data.title}
        </Typography>
        {data.description ? (
          <DocumentDescription
            labels={{ expand: t('taskWorkspace.readMore'), collapse: t('taskWorkspace.readLess') }}
            intro={data.description}
            hasMore={!!data.document}
            expanded={description}
            onExpandedChange={(expanded) => setDescription(expanded)}
            renderDocument={() => <MarkdownDocument source={data.document ?? ''} />}
          />
        ) : null}
        {data.phase === 'draft' ? (
          <Typography as="p" variant="body-md">
            {t('taskWorkspace.draftHelp')}
          </Typography>
        ) : null}
        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Typography as="span" variant="body-md" className="text-content-secondary">
              {t('taskWorkspace.status')}:
            </Typography>
            <Badge tone={data.status.tone}>
              <span className="inline-flex min-w-0 items-center gap-1">
                <Icon name={data.status.icon} size="sm" />
                {data.status.label}
              </span>
            </Badge>
          </div>
          {data.step && data.phase !== 'completed' && data.phase !== 'draft' ? (
            <Typography as="p" variant="body-md">
              <span className="text-content-secondary">
                {t(
                  data.phase === 'ready' || data.phase === 'waiting'
                    ? 'taskWorkspace.nextStep'
                    : 'taskWorkspace.step',
                )}
                :
              </span>{' '}
              {data.step.name}
              {data.phase !== 'ready' && data.phase !== 'waiting' && data.step.attempt !== undefined
                ? ` · ${t('taskWorkspace.attempt', { count: data.step.attempt })}`
                : ''}
            </Typography>
          ) : null}
        </div>
      </div>
      {data.step?.instruction && data.phase !== 'draft' ? (
        <div className="grid min-w-0 justify-items-start gap-2">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="file"
            trailingIcon={instruction ? ChevronDown : ChevronRight}
            aria-expanded={instruction}
            aria-controls={instructionId}
            className="h-auto text-left whitespace-normal"
            onClick={() => setInstruction(!instruction)}
          >
            {t(
              data.phase === 'completed'
                ? 'taskWorkspace.lastInstruction'
                : 'taskWorkspace.instruction',
              { step: data.step.name },
            )}
          </Button>
          <div id={instructionId} hidden={!instruction} className="w-full min-w-0">
            {instruction ? <MarkdownDocument source={data.step.instruction} /> : null}
          </div>
        </div>
      ) : null}
      {(data.phase === 'ready' || data.phase === 'waiting') && data.startLabel ? (
        <Button
          size="sm"
          variant="primary"
          leadingIcon="workflow"
          className="justify-self-start"
          onClick={() => setMessage(t('taskWorkspace.startDemo'))}
        >
          {data.startLabel}
        </Button>
      ) : null}
      <TaskWorkspaceSessions />
      {last ? (
        <WorkspaceSection
          aria-label={t(
            data.phase === 'completed' ? 'taskWorkspace.lastDecision' : 'taskWorkspace.lastHandoff',
          )}
          className="border-t border-border-subtle pt-5"
        >
          <WorkspaceSection.Header
            title={t(
              data.phase === 'completed'
                ? 'taskWorkspace.lastDecision'
                : 'taskWorkspace.lastHandoff',
            )}
            icon="arrow-right"
            headingTag="h2"
          />
          <Typography as="p" variant="title-sm">
            {last.from} → {last.to}
          </Typography>
          {last.result ? (
            <Badge tone={last.result.tone} className="justify-self-start">
              {last.result.label}
            </Badge>
          ) : null}
          {last.feedback ? <MarkdownDocument source={last.feedback} /> : null}
          <TaskWorkspaceMaterials materials={last.materials} onOpen={onMaterial} />
        </WorkspaceSection>
      ) : null}
      <TaskWorkspaceDecision />
      {message ? (
        <Typography as="p" variant="body-md" role="status">
          {message}
        </Typography>
      ) : null}
      {onHistory ? (
        <Button
          variant="secondary"
          size="sm"
          leadingIcon="clock"
          className="justify-self-start"
          onClick={onHistory}
        >
          {t('taskWorkspace.history')}
        </Button>
      ) : null}
    </div>
  );
}
