import { useQuery } from '@tanstack/react-query';
import { isHttpClientError } from '@nevo/http-client';
import { Alert, Button, MarkdownDocument, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { useAppServices } from '../../../app/useAppServices';
import { markdownIntro } from '../description/markdownIntro';
import { documentKeys } from '../queries';

export function DocumentContent({
  specId,
  documentId,
  expectedRevision,
  omitTitle,
  headingOffset = 0,
}: {
  readonly specId: string;
  readonly documentId: string;
  readonly expectedRevision?: string;
  readonly omitTitle?: string;
  readonly headingOffset?: 0 | 1 | 2 | 3 | 4 | 5;
}) {
  const { t } = useTranslation();
  const { documentApi } = useAppServices();
  const query = useQuery({
    queryKey: documentKeys.detail(specId, documentId, expectedRevision),
    queryFn: ({ signal }) => documentApi.getDocument(specId, documentId, signal, expectedRevision),
  });

  if (query.isPending)
    return (
      <Typography variant="body-sm">
        {t('specification.loadingWorkspace', { id: documentId })}
      </Typography>
    );
  if (query.isError) {
    const forbidden = isHttpClientError(query.error) && query.error.status === 403;
    const title = t(
      forbidden ? 'specification.resourceAccessDeniedTitle' : 'specification.unavailableTitle',
    );
    const description = forbidden
      ? t('specification.resourceAccessDeniedDescription')
      : t('specification.unavailableDescription', { id: documentId });
    return (
      <div className="grid gap-3">
        <Alert tone="attention" role="alert" title={title}>
          {description}
        </Alert>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }
  if (
    query.data.id !== documentId ||
    (expectedRevision && query.data.revision !== expectedRevision)
  ) {
    return <Alert tone="attention" role="alert" title={t('specification.unavailableTitle')} />;
  }
  return (
    <MarkdownDocument
      headingOffset={headingOffset}
      source={omitTitle ? markdownIntro(query.data.content, omitTitle).source : query.data.content}
    />
  );
}
