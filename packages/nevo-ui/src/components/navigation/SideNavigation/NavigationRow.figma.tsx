import { defineDesignComponent } from '@nevo/figma-core/authoring';
export const designSpec = defineDesignComponent({
  component: 'NavigationRow',
  description: 'Flat route row with an independent optional disclosure and bounded content.',
  order: 28,
  variants: {
    state: ['none', 'active'],
    disclosure: ['none', 'collapsed', 'expanded'],
    selectionTreatment: ['marker', 'surface'],
  },
  defaults: { state: 'none', disclosure: 'none', selectionTreatment: 'marker' },
  slots: {
    label: { kind: 'text', propertyName: 'Label', defaultText: 'Sessions' },
    preview: { kind: 'container' },
  },
});
