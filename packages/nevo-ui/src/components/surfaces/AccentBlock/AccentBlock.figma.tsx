import { defineRecipeDesign } from '@nevo/ui/figma/define';
import { accentBlockRecipe } from './AccentBlock';

export const designSpec = defineRecipeDesign({
  component: 'AccentBlock',
  recipe: accentBlockRecipe,
  order: 75,
  description: 'Neutral content grouping with a continuous primary accent on the left.',
  slots: { content: { kind: 'slot', propertyName: 'Content', required: true } },
});
