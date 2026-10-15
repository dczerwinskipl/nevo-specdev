export type ProjectHomeErrorCode =
  | 'PROJECT_HOME_NOT_FOUND'
  | 'PROJECT_HOME_AMBIGUOUS'
  | 'PROJECT_HOME_INVALID'
  | 'PROJECT_HOME_MISMATCH';

export class ProjectHomeError extends Error {
  readonly code: ProjectHomeErrorCode;

  constructor(code: ProjectHomeErrorCode, message: string) {
    super(message);
    this.name = 'ProjectHomeError';
    this.code = code;
  }
}
