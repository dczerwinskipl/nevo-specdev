import type { IconName } from '@nevo/ui';
import { defineUiExtensionPoint, type UiContribution } from '../../../app/ui-modules/contracts';
import type { AttentionItem } from '../workspace/model';
import type { SpecificationWorkSectionContext } from './specificationWorkSections';

/** A module contributes presentation/actions for attention sourced from the Runtime snapshot. */
export interface SpecificationAttentionEntry {
  readonly item: AttentionItem;
  readonly icon: IconName;
  readonly action?: {
    readonly label: string;
    readonly labelKey?:
      | 'specification.attentionViewTask'
      | 'specification.openSessionAction'
      | 'specification.viewRepository';
    readonly onClick: () => void;
    readonly disabled?: boolean;
    readonly disabledTitleKey?: 'common.notImplemented';
  };
}

/** A data source can be healthy with no items, unavailable or intentionally excluded. */
export type SpecificationAttentionResult =
  | readonly SpecificationAttentionEntry[]
  | { readonly state: 'unavailable' }
  | { readonly state: 'excluded' };

export interface SpecificationAttentionContribution extends UiContribution {
  readonly getItems: (context: SpecificationWorkSectionContext) => SpecificationAttentionResult;
}

export const specificationAttentionItems =
  defineUiExtensionPoint<SpecificationAttentionContribution>('specification.attention.items');
