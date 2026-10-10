import {
  contributeTo,
  defineUiExtensionPoint,
  type UiContribution,
  type UiModule,
} from './contracts';
import { createUiRegistry } from './registry';

interface TestSettingsContribution extends UiContribution {
  readonly settingsKey: string;
  readonly editable: boolean;
}
const settings = defineUiExtensionPoint<TestSettingsContribution>('test.project.settings.sections');
const registered = contributeTo(settings, {
  id: 'test.settings',
  settingsKey: 'git.push',
  editable: true,
});
const registry = createUiRegistry([settings], [{ id: 'test.module', contributions: [registered] }]);

/** Compile-time checks: registration and lookup are both typed to the host contract. */
export function verifyUiExtensionPointTypes() {
  const contribution = registry.get(settings)[0];
  if (!contribution) return;
  const settingsKey: string = contribution.settingsKey;
  const editable: boolean = contribution.editable;
  void settingsKey;
  void editable;

  // @ts-expect-error Missing required settings-specific property.
  contributeTo(settings, { id: 'invalid', editable: true });

  const brokenModule: UiModule = {
    id: 'test.broken',
    contributions: [
      // @ts-expect-error A handwritten contribution registration lacks the private brand.
      { point: settings, contribution: { id: 'missing-settings-key' } },
    ],
  };
  void brokenModule;
}
