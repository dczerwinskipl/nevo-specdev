import type { ComponentType } from 'react';
import { defineUiExtensionPoint, type UiContribution } from '../../../app/ui-modules/contracts';
import type { SpecificationWorkspaceData } from '../workspace/model';
import type { WorkspaceRuntime } from '../workspace/WorkspaceContext';

/** Host-specific context. This aggregate Workspace adapter is transitional, not a plugin API. */
export interface SpecificationWorkSectionContext {
  readonly specId: string;
  readonly data: SpecificationWorkspaceData;
  readonly actions: WorkspaceRuntime;
}

export interface SpecificationWorkSectionContribution extends UiContribution {
  readonly slot: 'context' | 'main' | 'related';
  readonly isVisible?: (context: SpecificationWorkSectionContext) => boolean;
  readonly Component: ComponentType<SpecificationWorkSectionContext>;
}

export type SpecificationWorkSlot = SpecificationWorkSectionContribution['slot'];

export const specificationWorkSections =
  defineUiExtensionPoint<SpecificationWorkSectionContribution>('specification.work.sections');
