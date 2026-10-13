import { Button, Field, SegmentedControl, TextArea, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { WorkspaceSection } from '../../specs/workspace/sections/WorkspaceSection';
import { useTaskWorkspace } from './TaskWorkspaceState';

export function TaskWorkspaceDecision() {
  const { t } = useTranslation();
  const { data, decision, setDecision, feedback, setFeedback, error, setError, setMessage } =
    useTaskWorkspace();
  if (data.phase !== 'human' || !data.decisions.length) return null;
  const selected = data.decisions.find((item) => item.id === decision);
  return (
    <WorkspaceSection aria-label={t('taskWorkspace.decision')}>
      <WorkspaceSection.Header
        title={t('taskWorkspace.decision')}
        icon="workflow"
        headingTag="h2"
      />
      <SegmentedControl
        value={decision}
        onValueChange={(value) => {
          setDecision(value);
          setError(false);
          setMessage('');
        }}
        aria-label={t('taskWorkspace.decision')}
      >
        {data.decisions.map((item) => (
          <SegmentedControl.Item key={item.id} value={item.id}>
            {item.label}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl>
      {selected ? (
        <form
          noValidate
          className="grid min-w-0 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected.feedbackRequired && !feedback.trim()) {
              setError(true);
              return;
            }
            setError(false);
            setMessage(t('taskWorkspace.decisionDemo'));
          }}
        >
          <Typography as="p" variant="body-md">
            {selected.consequence}
          </Typography>
          <Field invalid={error}>
            <Field.Label>
              {t(
                selected.feedbackRequired
                  ? 'taskWorkspace.requiredFeedback'
                  : 'taskWorkspace.optionalFeedback',
              )}
            </Field.Label>
            <TextArea
              value={feedback}
              required={selected.feedbackRequired}
              onChange={(event) => {
                setFeedback(event.target.value);
                setError(false);
              }}
            />
            {error ? <Field.Error>{t('taskWorkspace.feedbackError')}</Field.Error> : null}
          </Field>
          <Button type="submit" size="sm" variant="primary" className="justify-self-start">
            {t('taskWorkspace.confirm')}
          </Button>
        </form>
      ) : null}
    </WorkspaceSection>
  );
}
