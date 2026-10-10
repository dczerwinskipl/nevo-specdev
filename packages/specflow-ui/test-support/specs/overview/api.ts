import type { SpecsOverviewApi } from '../../../src/features/specs/overview/api';
import { createSpecsFixture } from './fixtures';

export function createFixtureSpecsOverviewApi(): SpecsOverviewApi {
  return {
    getOverview: (collection, signal) => {
      signal?.throwIfAborted();
      return Promise.resolve(createSpecsFixture(collection));
    },
  };
}
