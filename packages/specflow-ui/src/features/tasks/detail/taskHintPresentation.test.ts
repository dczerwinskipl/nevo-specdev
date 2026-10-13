import { describe, expect, it } from 'vitest';
import { presentTaskHints } from './taskHintPresentation';

describe('Task hint reading identities', () => {
  it('uses only recognized file/document path syntax and preserves the exact original', () => {
    const hints = [
      { kind: 'file' as const, ref: 'src/session.ts' },
      { kind: 'doc' as const, ref: 'C:\\docs\\guide.md' },
      { kind: 'skill' as const, ref: 'team/agent.v2' },
      { kind: 'doc' as const, ref: 'opaque/id' },
      { kind: 'doc' as const, ref: 'doc://private/guide.md' },
      { kind: 'file' as const, ref: 'file.ts?rev=1' },
      { kind: 'doc' as const, ref: 'team/opaque.v2' },
    ];
    const result = presentTaskHints(hints);
    expect(result.map((item) => item.name)).toEqual([
      'session.ts',
      'guide.md',
      'team/agent.v2',
      'opaque/id',
      'doc://private/guide.md',
      'file.ts?rev=1',
      'team/opaque.v2',
    ]);
    expect(result.map((item) => item.hint.ref)).toEqual(hints.map((hint) => hint.ref));
  });
  it('disambiguates colliding basenames with the shortest differing parent suffix', () => {
    const result = presentTaskHints([
      { kind: 'file', ref: 'src/a/shared/session.ts' },
      { kind: 'file', ref: 'src/b/shared/session.ts' },
      { kind: 'file', ref: 'docs/session.ts' },
      { kind: 'file', ref: 'docs/session.ts' },
    ]);
    expect(result.map((item) => item.parent)).toEqual(['a/shared', 'b/shared', 'docs', 'docs']);
  });
  it('does not invent provenance for identical references or empty collections', () => {
    expect(presentTaskHints([])).toEqual([]);
    expect(
      presentTaskHints([
        { kind: 'file', ref: 'a/file.ts' },
        { kind: 'file', ref: 'a/file.ts' },
      ]).map((item) => item.parent),
    ).toEqual([undefined, undefined]);
  });
});
