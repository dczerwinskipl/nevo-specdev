import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import type { RuntimeFeature } from '../runtime-feature';
import { defaultSpecsFeatureConfig, type SpecsFeatureConfig } from './configuration';
import { specsOverviewEndpoint } from './overview/endpoint';
import type { SpecsOverviewRepository } from './overview/repository/read-repository';
import { specificationWorkspaceEndpoint } from './workspace/endpoint';
import type { SpecificationWorkspaceRepository } from './workspace/repository';
import { createDemoSpecsRepositories } from './demo/repositories';

export interface SpecsFeatureDependencies {
  readonly mode?: 'project' | 'demo';
  readonly overviewRepository?: SpecsOverviewRepository;
  readonly workspaceRepository?: SpecificationWorkspaceRepository;
}

export interface CreateSpecsFeatureOptions {
  readonly config?: SpecsFeatureConfig;
  readonly dependencies?: SpecsFeatureDependencies;
}

export function createSpecsFeature(options: CreateSpecsFeatureOptions = {}): RuntimeFeature {
  const demo = options.dependencies?.mode === 'demo' ? createDemoSpecsRepositories() : undefined;
  const overviewRepository = options.dependencies?.overviewRepository ?? demo?.overviewRepository;
  const workspaceRepository =
    options.dependencies?.workspaceRepository ?? demo?.workspaceRepository;
  const config = options.config ?? defaultSpecsFeatureConfig();

  return {
    authorizationResources: [SpecCapabilities],
    register(app) {
      app.register(specsOverviewEndpoint, {
        repository: overviewRepository,
        currentSections: config.overview.current.sections,
      });
      app.register(specificationWorkspaceEndpoint, { repository: workspaceRepository });
    },
  };
}
