import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import type { SpecFlowEngine } from '@nevo/specflow-engine';

import type { RuntimeFeature } from '../runtime-feature';
import { defaultSpecsFeatureConfig, type SpecsFeatureConfig } from './configuration';
import { specsCreateEndpoint } from './create/endpoint';
import { specsOverviewEndpoint } from './overview/endpoint';
import type { SpecsOverviewRepository } from './overview/repository/read-repository';
import { createEngineSpecsOverviewRepository } from './overview/repository/engine-repository';

export interface SpecsFeatureDependencies {
  readonly overviewRepository?: SpecsOverviewRepository;
  readonly engine?: SpecFlowEngine;
}

export interface CreateSpecsFeatureOptions {
  readonly config?: SpecsFeatureConfig;
  readonly dependencies?: SpecsFeatureDependencies;
}

export function createSpecsFeature(options: CreateSpecsFeatureOptions = {}): RuntimeFeature {
  // Demo data is available only through an explicit injected repository.
  // Production composition supplies the Engine; absent Engine is an unavailable
  // source, never a synthetic list of example specifications.
  const repository =
    options.dependencies?.overviewRepository ??
    (options.dependencies?.engine
      ? createEngineSpecsOverviewRepository(options.dependencies.engine)
      : undefined);
  const config = options.config ?? defaultSpecsFeatureConfig();

  return {
    authorizationResources: [SpecCapabilities],

    register(app) {
      app.register(specsCreateEndpoint, { engine: options.dependencies?.engine });
      app.register(specsOverviewEndpoint, {
        repository,
        currentSections: config.overview.current.sections,
      });
    },
  };
}
