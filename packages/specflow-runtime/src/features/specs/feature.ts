import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import type { SpecFlowEngine } from '@nevo/specflow-engine';

import type { RuntimeFeature } from '../runtime-feature';
import { defaultSpecsFeatureConfig, type SpecsFeatureConfig } from './configuration';
import { specsCreateEndpoint } from './create/endpoint';
import { specsOverviewEndpoint } from './overview/endpoint';
import type { SpecsOverviewRepository } from './overview/repository/read-repository';
import { createSampleSpecsOverviewRepository } from './overview/repository/sample-repository';

export interface SpecsFeatureDependencies {
  readonly overviewRepository?: SpecsOverviewRepository;
  readonly engine?: SpecFlowEngine;
}

export interface CreateSpecsFeatureOptions {
  readonly config?: SpecsFeatureConfig;
  readonly dependencies?: SpecsFeatureDependencies;
}

export function createSpecsFeature(options: CreateSpecsFeatureOptions = {}): RuntimeFeature {
  const repository =
    options.dependencies?.overviewRepository ?? createSampleSpecsOverviewRepository();
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
