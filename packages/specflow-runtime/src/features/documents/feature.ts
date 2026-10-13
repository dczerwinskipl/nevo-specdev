import type { RuntimeFeature } from '../runtime-feature';
import { documentContentEndpoint } from './content/endpoint';
import type { DocumentContentSource } from './content/read-document';
export interface DocumentsFeatureDependencies {
  source?: DocumentContentSource;
}
export function createDocumentsFeature(
  dependencies: DocumentsFeatureDependencies = {},
): RuntimeFeature {
  return {
    authorizationResources: [],
    register(app) {
      app.register(documentContentEndpoint, { source: dependencies.source });
    },
  };
}
