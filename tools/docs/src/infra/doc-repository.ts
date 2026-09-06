// The real filesystem-backed DocRepository.

import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';

import type { ScanResult } from '../domain/corpus.js';
import { parseFrontmatter, type DocRecord } from '../domain/frontmatter.js';
import type { BuiltIndex, OnDiskIndex } from '../domain/index-file.js';
import type { DocRepository } from '../ports.js';

const EXEMPT_DIR_PREFIXES = ['templates/'];

export function isFrontmatterExempt(fileRelToDocs: string): boolean {
  if (fileRelToDocs.includes('.generated.')) return true;
  return EXEMPT_DIR_PREFIXES.some((p) => fileRelToDocs === p || fileRelToDocs.startsWith(p));
}

function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkMarkdown(full));
    else if (extname(name) === '.md' && !name.includes('.generated.')) out.push(full);
  }
  return out;
}

export interface DocRepositoryPaths {
  readonly repoRoot: string;
  readonly docsDir: string;
}

export function createFileSystemDocRepository({
  repoRoot,
  docsDir,
}: DocRepositoryPaths): DocRepository {
  const adrDir = join(docsDir, 'architecture', 'decisions');

  return {
    scan(): ScanResult {
      const docs: DocRecord[] = [];
      const missingFrontmatter: string[] = [];

      for (const abs of walkMarkdown(docsDir)) {
        const file = relative(repoRoot, abs).split(sep).join('/');
        const relToDocs = relative(docsDir, abs).split(sep).join('/');
        const parsed = parseFrontmatter(readFileSync(abs, 'utf8'), file);
        if (parsed === null) {
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
      try {
        return readdirSync(adrDir).filter((f) => f.endsWith('.md'));
      } catch (err) {
        throw new Error(
          `cannot read ${adrDir}: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }
    },

    writeDoc(repoRelPath, content): void {
      writeFileSync(join(repoRoot, repoRelPath), content);
    },

    removeDoc(repoRelPath): void {
      rmSync(join(repoRoot, repoRelPath), { force: true });
    },

    readIndex(): OnDiskIndex {
      const jsonPath = join(docsDir, 'index.generated.json');
      const mdPath = join(docsDir, 'index.generated.md');
      return {
        json: existsSync(jsonPath) ? readFileSync(jsonPath, 'utf8') : null,
        md: existsSync(mdPath) ? readFileSync(mdPath, 'utf8') : null,
      };
    },

    writeIndex(index: BuiltIndex): void {
      writeFileSync(join(docsDir, 'index.generated.json'), index.json);
      writeFileSync(join(docsDir, 'index.generated.md'), index.md);
    },
  };
}

/** Nearest ancestor of `start` holding `pnpm-workspace.yaml`. */
export function findRepoRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}
