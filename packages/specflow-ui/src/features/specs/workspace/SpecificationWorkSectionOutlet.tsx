import { Component, type ReactNode } from 'react';
import { Alert, Button } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { UiRegistry } from '../../../app/ui-modules/registry';
import {
  specificationWorkSections,
  type SpecificationWorkSectionContext,
  type SpecificationWorkSectionContribution,
  type SpecificationWorkSlot,
} from '../extensions/specificationWorkSections';
import { useWorkspaceRuntime } from './WorkspaceContext';
import type { SpecificationWorkspaceData } from './model';

interface SectionBoundaryProps {
  readonly fallback: (retryRender: () => void) => ReactNode;
  readonly children: ReactNode;
}

interface SectionBoundaryState {
  readonly failed: boolean;
}

/**
 * Isolate render failures until a manual render retry or a new resource identity.
 * A render boundary does not know a feature's Query keys and never refetches data.
 * Feature-owned data errors and Retry must be handled by the connected feature itself.
 */
export class SectionBoundary extends Component<SectionBoundaryProps, SectionBoundaryState> {
  override state: SectionBoundaryState = { failed: false };

  static getDerivedStateFromError(): Partial<SectionBoundaryState> {
    return { failed: true };
  }

  private readonly retryRender = () => {
    // If the underlying render problem remains, React catches the same error
    // and shows the fallback again instead of claiming successful recovery.
    this.setState({ failed: false });
  };

  override render() {
    return this.state.failed ? this.props.fallback(this.retryRender) : this.props.children;
  }
}

function RegisteredWorkSection({
  contribution,
  context,
}: {
  readonly contribution: SpecificationWorkSectionContribution;
  readonly context: SpecificationWorkSectionContext;
}) {
  if (contribution.isVisible && !contribution.isVisible(context)) {
    return null;
  }

  const Section = contribution.Component;
  return (
    <div className="py-6">
      <Section {...context} />
    </div>
  );
}

export interface SpecificationWorkSectionOutletProps {
  readonly slot: SpecificationWorkSlot;
  readonly specId: string;
  readonly data: SpecificationWorkspaceData;
  readonly modules: UiRegistry;
}

/** The Work host provides placement, not knowledge of the registered feature. */
export function SpecificationWorkSectionOutlet({
  slot,
  specId,
  data,
  modules,
}: SpecificationWorkSectionOutletProps) {
  const { t } = useTranslation();
  const actions = useWorkspaceRuntime();
  const context: SpecificationWorkSectionContext = { specId, data, actions };
  const sections = modules
    .get(specificationWorkSections)
    .filter((contribution) => contribution.slot === slot);
  return (
    <>
      {sections.map((contribution) => (
        <SectionBoundary
          key={`${specId}:${contribution.id}`}
          fallback={(retryRender) => (
            <div className="grid gap-2 py-6">
              <Alert
                role="alert"
                tone="attention"
                title={t('specification.sectionRenderFailedTitle')}
              >
                {t('specification.sectionRenderFailedDescription')}
              </Alert>
              <div>
                <Button variant="secondary" size="sm" onClick={retryRender}>
                  {t('common.retry')}
                </Button>
              </div>
            </div>
          )}
        >
          <RegisteredWorkSection contribution={contribution} context={context} />
        </SectionBoundary>
      ))}
    </>
  );
}
