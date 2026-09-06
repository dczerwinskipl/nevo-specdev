// Build / compare the generated documentation index. Pure — the app layer does
// the filesystem reads/writes.

import { asString, type DocRecord } from './frontmatter.js';

const GENERATED_NOTICE = '<!-- GENERATED FILE — do not edit. Run: pnpm docs:check --write -->\n\n';
const TYPE_ORDER = ['hub', 'architecture', 'adr', 'development', 'product'];

function typeRank(type: string): number {
  const i = TYPE_ORDER.indexOf(type);
  return i === -1 ? TYPE_ORDER.length : i;
}

function relLink(file: string): string {
  return file.replace(/^docs\//, '');
}

export interface BuiltIndex {
  readonly json: string;
  readonly md: string;
}

/** Deterministic index content — no timestamp, so `--write` twice is a no-op. */
export function buildIndex(docs: readonly DocRecord[]): BuiltIndex {
  const sorted = [...docs].sort(
    (a, b) =>
      typeRank(asString(a.type)) - typeRank(asString(b.type)) ||
      asString(a.id).localeCompare(asString(b.id)),
  );

  const byType = new Map<string, DocRecord[]>();
  for (const doc of sorted) {
    const key = asString(doc.type);
    const group = byType.get(key) ?? [];
    group.push(doc);
    byType.set(key, group);
  }

  let md = `${GENERATED_NOTICE}# Documentation index\n\n`;
  md +=
    'Regenerate with `pnpm docs:check --write`. Human-authored navigation lives in ' +
    '[`docs/README.md`](README.md).\n\n';

  for (const [type, group] of byType) {
    md += `## ${type.charAt(0).toUpperCase()}${type.slice(1)}\n\n`;
    md += '| ID | Title | Status | Summary |\n|---|---|---|---|\n';
    for (const doc of group) {
      const summary = asString(doc.summary).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
      md +=
        `| \`${asString(doc.id)}\` | [${asString(doc.title)}](${relLink(doc.file)}) | ` +
        `${asString(doc.status)} | ${summary} |\n`;
    }
    md += '\n';
  }

  const json = `${JSON.stringify(
    {
      docs: sorted.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        status: d.status,
        file: d.file,
        read_when: Array.isArray(d.read_when) ? d.read_when : [],
        summary: typeof d.summary === 'string' ? d.summary : '',
        related: Array.isArray(d.related) ? d.related : [],
      })),
    },
    null,
    2,
  )}\n`;

  return { json, md };
}

export interface OnDiskIndex {
  readonly md: string | null;
  readonly json: string | null;
}

/** Compare a freshly built index against what is on disk. */
export function diffIndex(built: BuiltIndex, onDisk: OnDiskIndex): string[] {
  const problems: string[] = [];
  if (onDisk.json === null) {
    problems.push('missing: docs/index.generated.json — run `pnpm docs:check --write`');
  } else if (onDisk.json.replace(/\r\n/g, '\n') !== built.json) {
    problems.push('stale: docs/index.generated.json — run `pnpm docs:check --write`');
  }
  if (onDisk.md === null) {
    problems.push('missing: docs/index.generated.md — run `pnpm docs:check --write`');
  } else if (onDisk.md.replace(/\r\n/g, '\n') !== built.md) {
    problems.push('stale: docs/index.generated.md — run `pnpm docs:check --write`');
  }
  return problems;
}
