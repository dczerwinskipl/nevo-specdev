import { tv } from 'tailwind-variants/lite';
import { defineRecipeDesign } from '@nevo/ui/figma/define';
import { informationListDefaults } from './informationListContract';

const informationListDesignRecipe = tv({
  base: 'm-0 min-w-0 list-none divide-y divide-border-subtle p-0',
  variants: {
    selectable: {
      true: '',
      false: '',
    },
  },
  defaultVariants: informationListDefaults,
});

export const designSpec = defineRecipeDesign({
  component: 'InformationList',
  description:
    'Structured operational list for high-density information scan with optional leading selection, flexible content, and trailing actions.',
  order: 145,
  recipe: informationListDesignRecipe,
  slots: {
    item: { kind: 'slot', propertyName: 'Item', required: true },
  },
});
