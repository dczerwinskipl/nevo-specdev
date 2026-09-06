import { describe, expect, it } from 'vitest';

import { resolveProductVersion } from '../src/version.js';
import { StepFailedError } from '../src/exec.js';

const base = { repoRoot: process.cwd(), releaseBin: 'unused-when-override' };

describe('resolveProductVersion', () => {
  it('accepts a plain release version via override (no subprocess)', () => {
    expect(resolveProductVersion({ ...base, override: '1.4.0' })).toBe('1.4.0');
  });

  it('accepts a channel prerelease build version', () => {
    expect(resolveProductVersion({ ...base, override: '0.1.0-alpha.0' })).toBe('0.1.0-alpha.0');
    expect(resolveProductVersion({ ...base, override: '1.3.0-rc.10' })).toBe('1.3.0-rc.10');
  });

  it('rejects a value that is not a valid npm package version', () => {
    expect(() => resolveProductVersion({ ...base, override: 'not-a-version' })).toThrow(
      StepFailedError,
    );
    expect(() => resolveProductVersion({ ...base, override: '1.2' })).toThrow(/not a valid npm/);
  });
});
