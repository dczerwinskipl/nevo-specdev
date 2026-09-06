/**
 * Deep structural comparison of `actual` against `expected`, where `expected` is
 * a partial: every key in `expected` must be present and equal in `actual`, but
 * `actual` may carry extra keys. Arrays must match element-for-element.
 *
 * @returns human-readable difference paths (empty ⇒ satisfied)
 */
export function diffPartial(expected: unknown, actual: unknown, path = ''): string[] {
  const diffs: string[] = [];

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      diffs.push(
        `${path || '(root)'}: expected array of ${String(expected.length)}, got ${JSON.stringify(
          actual,
        )}`,
      );
      return diffs;
    }
    expected.forEach((v, i) => diffs.push(...diffPartial(v, actual[i], `${path}[${String(i)}]`)));
    return diffs;
  }

  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') {
      diffs.push(`${path || '(root)'}: expected object, got ${JSON.stringify(actual)}`);
      return diffs;
    }
    const actualObj = actual as Record<string, unknown>;
    for (const [k, v] of Object.entries(expected)) {
      diffs.push(...diffPartial(v, actualObj[k], path ? `${path}.${k}` : k));
    }
    return diffs;
  }

  if (expected !== actual) {
    diffs.push(
      `${path || '(root)'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
  return diffs;
}
