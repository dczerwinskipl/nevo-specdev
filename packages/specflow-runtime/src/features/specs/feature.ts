import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import type { RuntimeFeature } from '../runtime-feature';
import { defaultSpecsFeatureConfig, type SpecsFeatureConfig } from './configuration';
import { specsOverviewEndpoint } from './overview/endpoint';
import type { SpecsOverviewRepository } from './overview/repository/read-repository';
import { specificationWorkspaceEndpoint } from './workspace/endpoint';
import type {
  SpecificationWorkspaceRepository,
  WorkspaceContributions,
} from './workspace/repository';
import type { SessionReferenceOwner } from '../sessions';

export interface SpecsFeatureDependencies {
  readonly overviewRepository?: SpecsOverviewRepository;
  readonly workspaceRepository?: SpecificationWorkspaceRepository;
  readonly contributions?: WorkspaceContributions;
  readonly sessions?: SessionReferenceOwner;
}

export interface CreateSpecsFeatureOptions {
  readonly config?: SpecsFeatureConfig;
  readonly dependencies?: SpecsFeatureDependencies;
}

export function createSpecsFeature(options: CreateSpecsFeatureOptions = {}): RuntimeFeature {
  const overviewRepository = options.dependencies?.overviewRepository;
  const workspaceRepository = options.dependencies?.workspaceRepository;
  const config = options.config ?? defaultSpecsFeatureConfig();

  return {
    authorizationResources: [SpecCapabilities],
    register(app) {
      app.register(specsOverviewEndpoint, {
        repository: overviewRepository,
        currentSections: config.overview.current.sections,
      });
      app.register(specificationWorkspaceEndpoint, {
        repository: workspaceRepository,
        contributions: options.dependencies?.contributions,
        sessions: options.dependencies?.sessions,
      });
    },
  };
}
