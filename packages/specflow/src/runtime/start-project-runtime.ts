import { resolveGitCheckoutLayout, type GitCheckoutLayout } from '@nevo/specflow-engine';
import {
  startRuntime,
  type RuntimeHandle,
  type RuntimeStartOptions,
  type RuntimeWebApp,
} from '@nevo/specflow-runtime';

import { loadProductWebApp } from './web-app';

export interface StartProjectRuntimeDependencies {
  readonly resolveLayout?: (cwd: string) => Promise<GitCheckoutLayout>;
  readonly start?: (options: RuntimeStartOptions) => Promise<RuntimeHandle>;
  readonly loadWebApp?: () => Promise<RuntimeWebApp>;
}

export async function startProjectRuntime(
  cwd: string,
  dependencies: StartProjectRuntimeDependencies = {},
): Promise<RuntimeHandle> {
  const layout = await (dependencies.resolveLayout ?? resolveGitCheckoutLayout)(cwd);
  const webApp = await (dependencies.loadWebApp ?? loadProductWebApp)();
  return (dependencies.start ?? startRuntime)({
    projectRoot: layout.root,
    projectConfigPath: layout.projectConfigPath,
    localConfigPath: layout.localConfigPath,
    dependencies: { webApp },
  });
}
