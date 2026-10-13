import type { TaskHistoryPage } from '@nevo/specflow-contracts/specs/workspace';

type Hint = TaskHistoryPage['items'][number]['step']['hints'][number];

function pathParts(hint: Hint) {
  // Only recognized file/document path syntax. A skill or opaque ID may contain slashes.
  if (
    hint.kind === 'skill' ||
    /[?#]/.test(hint.ref) ||
    (/^[a-z][a-z\d+.-]*:/i.test(hint.ref) && !/^[a-z]:[\\/]/i.test(hint.ref))
  )
    return null;
  const parts = hint.ref.split(/[\\/]/);
  const name = parts.at(-1);
  const documentSuffix = /\.(?:md|mdx|txt|rst|adoc|pdf|docx?|html?)$/i;
  const fileSuffix =
    /\.(?:tsx?|jsx?|json|ya?ml|toml|xml|css|scss|less|vue|svelte|py|cs|go|rs|java|kt|swift|sh|ps1|sql|c|cpp|h|hpp|svg|png|jpe?g|webp)$/i;
  const recognized =
    name && (documentSuffix.test(name) || (hint.kind === 'file' && fileSuffix.test(name)));
  return parts.length > 1 && recognized ? parts : null;
}

export function presentTaskHints(hints: readonly Hint[]) {
  const paths = hints.map(pathParts);
  return hints.map((hint, index) => {
    const parts = paths[index];
    const name = parts?.at(-1) ?? hint.ref;
    if (!parts) return { hint, name };
    const others = hints.flatMap((other, otherIndex) =>
      other.ref !== hint.ref && paths[otherIndex]?.at(-1) === name ? [paths[otherIndex]] : [],
    );
    let parent: string | undefined;
    if (others.length) {
      const parents = parts.slice(0, -1);
      for (let count = 1; count <= parents.length; count++) {
        parent = parents.slice(-count).join(hint.ref.includes('\\') ? '\\' : '/');
        if (
          others.every(
            (other) =>
              other
                .slice(0, -1)
                .slice(-count)
                .join(hint.ref.includes('\\') ? '\\' : '/') !== parent,
          )
        )
          break;
      }
    }
    return { hint, name, parent };
  });
}
