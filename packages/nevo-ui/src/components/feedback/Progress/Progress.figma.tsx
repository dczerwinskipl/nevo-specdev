import { defineDesignComponent } from '@nevo/figma-core/authoring';

export const designSpec = defineDesignComponent({
  component: 'Progress',
  description:
    'Determinate progress track. Runtime value controls fill width; the design component captures canonical geometry and semantic color roles.',
  order: 114,
  variants: { size: ['default', 'compact'], variant: ['continuous', 'segmented'] },
  defaults: { size: 'default', variant: 'continuous' },
  slots: {},
});
