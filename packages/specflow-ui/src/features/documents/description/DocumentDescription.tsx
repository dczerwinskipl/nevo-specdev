import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';

export function descriptionScrollOwner(node: HTMLElement): HTMLElement {
  let parent = node.parentElement;
  while (parent) {
    if (
      /(auto|scroll)/.test(getComputedStyle(parent).overflowY) &&
      parent.scrollHeight > parent.clientHeight + 1
    )
      return parent;
    parent = parent.parentElement;
  }
  return document.scrollingElement as HTMLElement;
}

/** The full document mounts lazily; its query/authorization stays with Documents. */
export function DocumentDescription({
  intro,
  hasMore = false,
  renderDocument,
  expanded: controlledExpanded,
  savedScrollTop,
  onExpandedChange,
  labels,
}: {
  readonly intro?: string | null;
  readonly hasMore?: boolean;
  readonly renderDocument?: () => ReactNode;
  readonly expanded?: boolean;
  readonly savedScrollTop?: number;
  readonly onExpandedChange?: (expanded: boolean, scrollTop: number) => void;
  readonly labels?: { readonly expand: string; readonly collapse: string };
}) {
  const { t } = useTranslation();
  const id = useId();
  const [localExpanded, setExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const control = useRef<HTMLButtonElement>(null);
  const saved = useRef<{ owner: HTMLElement; top: number } | null>(null);
  const restore = useRef(false);
  useLayoutEffect(() => {
    if (!restore.current) return;
    const position =
      saved.current ??
      (control.current && savedScrollTop !== undefined
        ? { owner: descriptionScrollOwner(control.current), top: savedScrollTop }
        : null);
    if (position) position.owner.scrollTop = position.top;
    control.current?.focus({ preventScroll: true });
    restore.current = false;
  }, [expanded, savedScrollTop]);
  const toggle = () => {
    if (!expanded && control.current) {
      const owner = descriptionScrollOwner(control.current);
      saved.current = { owner, top: owner.scrollTop };
    }
    restore.current = true;
    onExpandedChange?.(!expanded, saved.current?.top ?? savedScrollTop ?? 0);
    setExpanded(!expanded);
  };
  if (!intro && !renderDocument) return null;
  return (
    <div className="mt-2 grid min-w-0 justify-items-start gap-2 [overflow-wrap:anywhere]">
      {!expanded && intro ? (
        <Typography variant="body-md" className="text-content-secondary">
          {intro}
        </Typography>
      ) : null}
      {hasMore && renderDocument ? (
        <Button
          ref={control}
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={toggle}
        >
          {expanded
            ? (labels?.collapse ?? t('taskDetails.showLess'))
            : intro
              ? (labels?.expand ?? t('taskDetails.showMore'))
              : t('taskDetails.showDescription')}
        </Button>
      ) : null}
      <div id={id} className="w-full min-w-0" hidden={!expanded}>
        {expanded ? renderDocument?.() : null}
      </div>
      {expanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          aria-expanded
          aria-controls={id}
          onClick={toggle}
        >
          {labels?.collapse ?? t('taskDetails.showLess')}
        </Button>
      ) : null}
    </div>
  );
}
