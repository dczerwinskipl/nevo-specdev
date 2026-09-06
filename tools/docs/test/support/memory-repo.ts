// In-memory DocRepository for application-level tests — no filesystem.

import type { ScanResult } from '../../src/domain/corpus.js';
import { parseFrontmatter, type DocRecord } from '../../src/domain/frontmatter.js';
import type { BuiltIndex, OnDiskIndex } from '../../src/domain/index-file.js';
import { isFrontmatterExempt } from '../../src/infra/doc-repository.js';
import type { DocRepository } from '../../src/ports.js';

export interface MemoryRepo extends DocRepository {
  /** repo-relative path -> file content. */
  readonly files: Map<string, string>;
  readonly writes: string[];
  readonly removes: string[];
}

/** `files`: repo-relative path (e.g. `docs/README.md`) -> content. */
export function createMemoryRepo(files: Record<string, string> = {}): MemoryRepo {
  const map = new Map(Object.entries(files));
  const writes: string[] = [];
  const removes: string[] = [];
  let index: OnDiskIndex = { md: null, json: null };

  return {
    files: map,
    writes,
    removes,

    scan(): ScanResult {
      const docs: DocRecord[] = [];
      const missingFrontmatter: string[] = [];
      for (const [file, content] of [...map.entries()].sort()) {
        if (!file.startsWith('docs/') || !file.endsWith('.md')) continue;
        if (file.includes('.generated.')) continue;
        const parsed = parseFrontmatter(content, file);
        if (parsed === null) {
          const relToDocs = file.slice('docs/'.length);
          if (!isFrontmatterExempt(relToDocs)) missingFrontmatter.push(file);
          continue;
        }
        docs.push({ ...parsed.frontmatter, file, body: parsed.body });
      }
      docs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      missingFrontmatter.sort();
      return { docs, missingFrontmatter };
    },

    adrFilenames(): string[] {
      const prefix = 'docs/architecture/decisions/';
      return [...map.keys()]
        .filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
        .map((f) => f.slice(prefix.length));
    },

    writeDoc(path, content): void {
      map.set(path, content);
      writes.push(path);
    },

    removeDoc(path): void {
      map.delete(path);
      removes.push(path);
    },

    readIndex: () => index,

    writeIndex(built: BuiltIndex): void {
      index = { md: built.md, json: built.json };
    },
  };
}
