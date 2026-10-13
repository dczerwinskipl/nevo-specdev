import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

interface Node {
  type: string;
  value?: string;
  alt?: string;
  children?: Node[];
}
const visibleText = (node: Node): string =>
  node.type === 'html'
    ? ''
    : node.type === 'image'
      ? (node.alt ?? '')
      : (node.value ?? node.children?.map(visibleText).join('') ?? '');

export function markdownIntro(source: string, title?: string) {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Node;
  const nodes = tree.children ?? [];
  const paragraph = nodes.find((node) => node.type === 'paragraph');
  const text = paragraph ? visibleText(paragraph).replace(/\s+/g, ' ').trim() : '';
  const graphemes = [
    ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
  ].map((part) => part.segment);
  let intro = graphemes.slice(0, 320).join('');
  if (graphemes.length > 320) {
    const boundary = intro.lastIndexOf(' ');
    if (boundary > 240) intro = intro.slice(0, boundary);
    intro = intro.trimEnd() + '…';
  }
  const first = nodes[0];
  const omitHeading = first?.type === 'heading' && visibleText(first).trim() === title?.trim();
  const displaySource = omitHeading ? body.replace(/^\s*#[^\n]*\r?\n/, '') : body;
  const content = nodes.filter((node) => node !== (omitHeading ? first : undefined));
  return {
    intro,
    hasMore:
      content.length > 0 &&
      (graphemes.length > 320 || content.length !== 1 || content[0]?.type !== 'paragraph'),
    source: displaySource,
  };
}
