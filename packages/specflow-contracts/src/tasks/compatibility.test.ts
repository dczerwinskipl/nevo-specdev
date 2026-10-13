import { describe, expect, it } from 'vitest';
import * as tasks from './index';
import * as documents from '../documents';
import * as legacy from '../specs/workspace';
describe('Read contract ownership compatibility', () => {
  it('re-exports the same schema objects from the legacy workspace path', () => {
    expect(legacy.TaskSnapshotSchema).toBe(tasks.TaskSnapshotSchema);
    expect(legacy.SpecificationTaskResponseSchema).toBe(tasks.SpecificationTaskResponseSchema);
    expect(legacy.SpecificationTaskParamsSchema).toBe(tasks.SpecificationTaskParamsSchema);
    expect(legacy.SpecificationDocumentResponseSchema).toBe(
      documents.SpecificationDocumentResponseSchema,
    );
    expect(legacy.SpecificationDocumentParamsSchema).toBe(
      documents.SpecificationDocumentParamsSchema,
    );
  });
});
