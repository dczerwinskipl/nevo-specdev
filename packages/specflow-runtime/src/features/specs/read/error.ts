export type SpecsReadErrorCode =
  | 'ENGINE_UNAVAILABLE'
  | 'SPEC_WORKSPACE_UNAVAILABLE'
  | 'SPEC_MANIFEST_MISSING'
  | 'SPEC_SOURCE_UNAVAILABLE';

export class SpecsReadError extends Error {
  readonly code: SpecsReadErrorCode;

  constructor(code: SpecsReadErrorCode, message: string) {
    super(message);
    this.name = 'SpecsReadError';
    this.code = code;
  }
}
