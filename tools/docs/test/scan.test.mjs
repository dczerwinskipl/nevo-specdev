import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanDocs, findRepoRoot } from '../src/scan.mjs';

let root;
let docsDir;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nevo-scan-'));
  docsDir = join(root, 'docs');
  mkdirSync(join(docsDir, 'development'), { recursive: true });
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('scanDocs', () => {
  it('parses docs with frontmatter, sorts by id, forward-slashes paths, skips the rest', () => {
    writeFileSync(
      join(docsDir, 'development', 'git-workflow.md'),
      '---\nid: development.git-workflow\ntype: development\ntitle: Git workflow\nstatus: current\n---\n# x\n',
    );
    writeFileSync(
      join(docsDir, 'README.md'),
      '---\nid: docs.readme\ntype: hub\ntitle: Docs\nstatus: current\n---\n',
    );
    writeFileSync(join(docsDir, 'no-frontmatter.md'), '# just prose\n');
    writeFileSync(join(docsDir, 'index.generated.md'), '---\nid: skip.me\n---\n');

    const docs = scanDocs({ docsDir, repoRoot: root });

    expect(docs.map((d) => d.id)).toEqual(['development.git-workflow', 'docs.readme']);
    expect(docs[0].file).toBe('docs/development/git-workflow.md');
  });

  it('returns [] when docs/ does not exist', () => {
    expect(scanDocs({ docsDir: join(root, 'missing'), repoRoot: root })).toEqual([]);
  });
});

describe('findRepoRoot', () => {
  it('walks up to the directory holding pnpm-workspace.yaml', () => {
    expect(findRepoRoot(join(docsDir, 'development'))).toBe(root);
  });

  it('falls back to the start dir when no marker is found', () => {
    const orphan = mkdtempSync(join(tmpdir(), 'nevo-orphan-'));
    try {
      expect(findRepoRoot(orphan)).toBe(orphan);
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });
});
