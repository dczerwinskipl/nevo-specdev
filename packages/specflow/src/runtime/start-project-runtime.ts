import {
  startRuntime,
  type RuntimeHandle,
  type RuntimeStartOptions,
  type RuntimeWebApp,
} from '@nevo/specflow-runtime';

import { resolveProjectLayout, type ProjectLayout } from '../project/layout';
import { loadProductWebApp } from './web-app';

export interface StartProjectRuntimeDependencies {
  readonly resolveLayout?: (cwd: string) => Promise<ProjectLayout>;
  readonly start?: (options: RuntimeStartOptions) => Promise<RuntimeHandle>;
  readonly loadWebApp?: () => Promise<RuntimeWebApp>;
}

export async function startProjectRuntime(
  cwd: string,
  dependencies: StartProjectRuntimeDependencies = {},
  options: { readonly demo?: boolean } = {},
): Promise<RuntimeHandle> {
  const layout = await (dependencies.resolveLayout ?? resolveProjectLayout)(cwd);
  const webApp = await (dependencies.loadWebApp ?? loadProductWebApp)();
  return (dependencies.start ?? startRuntime)({
    projectRoot: layout.root,
    ...(options.demo ? { demo: true } : {}),
    projectConfigPath: layout.projectConfigPath,
    localConfigPath: layout.localConfigPath,
    dependencies: { webApp },
  });
}
