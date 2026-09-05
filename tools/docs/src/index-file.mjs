// Build / write / check the generated documentation index. The build step is
// pure and deterministic (no timestamps); only write() stamps a time.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { validateDoc, validateCorpus } from './frontmatter.mjs';

const GENERATED_NOTICE =
  '<!-- GENERATED FILE — do not edit. Run: pnpm docs:check --write (or node tools/docs/bin/docs.mjs generate) -->\n\n';
const TIMESTAMP_RE = /^_Generated: .*_\r?\n\r?\n/m;

const TYPE_ORDER = ['hub', 'architecture', 'adr', 'development', 'product'];

/** @param {string} type */
function typeRank(type) {
  const i = TYPE_ORDER.indexOf(type);
  return i === -1 ? TYPE_ORDER.length : i;
}

/**
 * Deterministic index content (no timestamp).
 *
 * @param {Array<Record<string, any>>} docs
 */
export function buildIndex(docs) {
  const sorted = [...docs].sort(
    (a, b) => typeRank(a.type) - typeRank(b.type) || String(a.id).localeCompare(String(b.id)),
  );

  /** @type {Record<string, Array<Record<string, any>>>} */
  const byType = {};
  for (const doc of sorted) (byType[doc.type] ||= []).push(doc);

  let md = `${GENERATED_NOTICE}# Documentation index\n\n`;
  md +=
    'Regenerate with `pnpm docs:check --write`. Human-authored navigation lives in ' +
    '[`docs/README.md`](README.md).\n\n';

  for (const [type, group] of Object.entries(byType)) {
    md += `## ${type.charAt(0).toUpperCase()}${type.slice(1)}\n\n`;
    md += '| ID | Title | Status | Summary |\n|---|---|---|---|\n';
    for (const doc of group) {
      const summary = String(doc.summary || '')
        .replace(/\r?\n/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
      md += `| \`${doc.id}\` | [${doc.title}](${relLink(doc.file)}) | ${doc.status} | ${summary} |\n`;
    }
    md += '\n';
  }

  return {
    json: {
      docs: sorted.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        status: d.status,
        file: d.file,
        read_when: Array.isArray(d.read_when) ? d.read_when : [],
        summary: d.summary || '',
        related: Array.isArray(d.related) ? d.related : [],
      })),
    },
    md,
  };
}

/**
 * docs/index.generated.md links are relative to docs/
 * @param {string} file
 */
function relLink(file) {
  return file.replace(/^docs\//, '');
}

/**
 * @param {Array<Record<string, any>>} docs
 * @param {string} docsDir absolute path to docs/
 */
export function writeIndex(docs, docsDir) {
  const built = buildIndex(docs);
  const timestamp = new Date().toISOString();
  writeFileSync(
    join(docsDir, 'index.generated.json'),
    `${JSON.stringify({ generated: timestamp, ...built.json }, null, 2)}\n`,
  );
  writeFileSync(
    join(docsDir, 'index.generated.md'),
    built.md.replace(
      /^# Documentation index\n\n/m,
      `# Documentation index\n\n_Generated: ${timestamp}_\n\n`,
    ),
  );
}

/**
 * Validate the corpus and confirm the on-disk index matches a fresh build.
 *
 * @param {Array<Record<string, any>>} docs
 * @param {string} docsDir absolute path to docs/
 * @returns {string[]} problems (empty ⇒ everything current and valid)
 */
export function checkIndex(docs, docsDir) {
  const problems = [];
  for (const doc of docs) problems.push(...validateDoc(doc));
  problems.push(...validateCorpus(docs));
  if (problems.length) return problems;

  const built = buildIndex(docs);

  const jsonPath = join(docsDir, 'index.generated.json');
  if (!existsSync(jsonPath)) {
    problems.push('missing: docs/index.generated.json — run `pnpm docs:check --write`');
  } else {
    const onDisk = JSON.parse(readFileSync(jsonPath, 'utf8'));
    if (JSON.stringify(onDisk.docs) !== JSON.stringify(built.json.docs)) {
      problems.push('stale: docs/index.generated.json — run `pnpm docs:check --write`');
    }
  }

  const mdPath = join(docsDir, 'index.generated.md');
  if (!existsSync(mdPath)) {
    problems.push('missing: docs/index.generated.md — run `pnpm docs:check --write`');
  } else {
    const onDisk = readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n').replace(TIMESTAMP_RE, '');
    if (onDisk !== built.md.replace(/\r\n/g, '\n')) {
      problems.push('stale: docs/index.generated.md — run `pnpm docs:check --write`');
    }
  }

  return problems;
}
