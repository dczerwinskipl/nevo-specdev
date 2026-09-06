import type { DocRepository, Logger } from '../ports.js';

export interface DocsCliContext {
  readonly repo: DocRepository;
  readonly stdout: Logger;
  readonly stderr: Logger;
}
