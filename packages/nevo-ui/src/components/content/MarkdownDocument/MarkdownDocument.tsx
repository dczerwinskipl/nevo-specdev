import { createElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../../lib';
import { Link } from '../../actions/Link';
import { Typography } from '../../foundations/Typography';

export interface MarkdownDocumentLinkProps {
  children: ReactNode;
  href?: string;
  title?: string;
}

export interface MarkdownDocumentProps {
  source: string;
  className?: string;
  labels?: Partial<MarkdownDocumentLabels>;
  /** Semantic offset when embedded below a view title; visual styles remain unchanged. */
  headingOffset?: 0 | 1 | 2 | 3 | 4 | 5;
  /**
   * Product-owned link/reference renderer. Return null/undefined to keep the shared default link.
   * Use it to turn workspace-relative references into contextual navigation without reimplementing
   * Markdown parsing or normal external-link styling.
   */
  renderLink?: (props: MarkdownDocumentLinkProps) => ReactNode;
}

export interface MarkdownDocumentLabels {
  completedTask: string;
  incompleteTask: string;
}

const defaultMarkdownDocumentLabels: MarkdownDocumentLabels = {
  completedTask: 'Completed task',
  incompleteTask: 'Incomplete task',
};

function DefaultMarkdownLink({ children, href, title }: MarkdownDocumentLinkProps) {
  return (
    <Link href={href} rel="noreferrer noopener" target="_blank" title={title}>
      {children}
    </Link>
  );
}

function markdownComponents(
  labels: MarkdownDocumentLabels,
  renderLink?: (props: MarkdownDocumentLinkProps) => ReactNode,
  headingOffset = 0,
): Components {
  const heading = (level: number) =>
    `h${Math.min(6, level + headingOffset)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return {
    h1: ({ children }) => (
      <Typography
        as={heading(1)}
        className="mb-3 mt-8 text-content-primary first:mt-0"
        variant="title-lg"
      >
        {children}
      </Typography>
    ),
    h2: ({ children }) => (
      <Typography
        as={heading(2)}
        className="mb-3 mt-6 border-b border-divider pb-2 text-content-primary first:mt-0"
        variant="title-md"
      >
        {children}
      </Typography>
    ),
    h3: ({ children }) => (
      <Typography
        as={heading(3)}
        className="mb-2 mt-5 text-content-primary first:mt-0"
        variant="title-sm"
      >
        {children}
      </Typography>
    ),
    h4: ({ children }) => (
      <Typography
        as={heading(4)}
        className="mb-2 mt-4 text-content-primary first:mt-0"
        variant="label-md"
      >
        {children}
      </Typography>
    ),
    h5: ({ children }) => createElement(heading(5), undefined, children),
    h6: ({ children }) => createElement(heading(6), undefined, children),
    p: ({ children }) => (
      <Typography
        as="p"
        className="my-3 text-content-secondary first:mt-0 last:mb-0"
        variant="body-lg"
      >
        {children}
      </Typography>
    ),
    ul: ({ children, className }) => (
      <Typography
        as="ul"
        className={cn(
          'my-3 list-disc pl-6 text-content-secondary first:mt-0 last:mb-0',
          className?.includes('contains-task-list') && 'list-none pl-0',
        )}
        variant="body-lg"
      >
        {children}
      </Typography>
    ),
    ol: ({ children }) => (
      <Typography
        as="ol"
        className="my-3 list-decimal pl-6 text-content-secondary first:mt-0 last:mb-0"
        variant="body-lg"
      >
        {children}
      </Typography>
    ),
    li: ({ children, className }) => (
      <li className={cn('mt-1 first:mt-0', className)}>{children}</li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-content-primary">{children}</strong>
    ),
    a: ({ children, href, title }) =>
      renderLink?.({ children, href, title }) ?? (
        <DefaultMarkdownLink href={href} title={title}>
          {children}
        </DefaultMarkdownLink>
      ),
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-2 border-border-strong pl-4 text-content-muted first:mt-0 last:mb-0 [&_p]:text-body-md [&_p]:text-content-muted">
        {children}
      </blockquote>
    ),
    code: ({ children, className }) => (
      <Typography
        as="code"
        className={cn(
          'rounded-control-inline border border-border-default bg-surface-control px-1.5 py-0.5 text-content-secondary',
          className,
        )}
        variant="code-md"
      >
        {children}
      </Typography>
    ),
    pre: ({ children }) => (
      <pre className="my-3 max-w-full overflow-x-auto rounded-composite border border-border-default bg-canvas px-4 py-3 text-content-secondary first:mt-0 last:mb-0 [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0">
        {children}
      </pre>
    ),
    hr: () => <hr className="my-6 border-0 border-t border-divider" />,
    input: ({ node: _node, type, ...props }) => (
      <input
        {...props}
        aria-label={props.checked ? labels.completedTask : labels.incompleteTask}
        className="mr-2 accent-action-primary"
        disabled
        type={type}
      />
    ),
    table: ({ children }) => (
      <div className="my-3 w-full max-w-full overflow-x-auto first:mt-0 last:mb-0">
        <table className="min-w-full border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-border-default bg-surface-raised px-3 py-2 text-left">
        <Typography as="span" className="text-content-primary" variant="label-md">
          {children}
        </Typography>
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border-default px-3 py-2 text-left">
        <Typography as="span" className="text-content-secondary" variant="body-md">
          {children}
        </Typography>
      </td>
    ),
  };
}

export function MarkdownDocument({
  className,
  labels: labelsProp,
  renderLink,
  source,
  headingOffset = 0,
}: MarkdownDocumentProps) {
  const labels = { ...defaultMarkdownDocumentLabels, ...labelsProp };
  return (
    <div className={cn('w-full min-w-0 max-w-full [overflow-wrap:anywhere]', className)}>
      <ReactMarkdown
        components={markdownComponents(labels, renderLink, headingOffset)}
        remarkPlugins={[remarkGfm]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
