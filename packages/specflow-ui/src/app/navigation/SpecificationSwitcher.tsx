import { useId, useRef, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useRouterState, Link } from '@tanstack/react-router';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Icon,
  TextInput,
  Typography,
  Button,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { useAppServices } from '../useAppServices';
import { specsOverviewQueryOptions } from '../../features/specs/overview/queries';
import type { SpecsCollection, SpecOverviewItem } from '../../features/specs/overview/model';
import { useNavigationTransition } from './NavigationTransition';
export function pickerEntries(
  items: readonly SpecOverviewItem[],
  current: { id: string; title: string; key?: string } | undefined,
  term: string,
) {
  const query = term.trim().toLocaleLowerCase();
  const matches = (item: { title: string; key?: string }) =>
    [item.title, item.key ?? ''].some((value) => value.toLocaleLowerCase().includes(query));
  return [
    ...(current && matches(current) ? [current] : []),
    ...items.filter((item) => item.id !== current?.id && matches(item)).slice(0, 5),
  ];
}
export function SpecificationSwitcher({
  specId,
  title,
  displayKey,
  collection,
  identityAvailable,
}: {
  specId: string;
  title: string;
  displayKey?: string;
  collection: SpecsCollection;
  identityAvailable: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { specsOverviewApi } = useAppServices();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const routePending = useRouterState({ select: (state) => state.status === 'pending' });
  const { guardPending } = useNavigationTransition();
  const pending = routePending || guardPending;
  const [failure, setFailure] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const listId = useId();
  const committed = useRef(false);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const query = useQuery({
    ...specsOverviewQueryOptions(specsOverviewApi, collection),
    enabled: open,
  });
  const denied =
    query.error && 'status' in query.error && [401, 403, 404].includes(Number(query.error.status));
  const entries = pickerEntries(
    denied ? [] : (query.data?.items ?? []),
    identityAvailable ? { id: specId, title, key: displayKey } : undefined,
    term,
  );
  const choose = async (id: string) => {
    if (pending) return;
    if (id === specId) {
      setOpen(false);
      return;
    }
    setFailure(false);
    try {
      await router.navigate({
        to: '/specs/$specId',
        params: { specId: id },
        search: { collection },
      });
      if (router.state.location.pathname === `/specs/${encodeURIComponent(id)}`) {
        committed.current = true;
        setOpen(false);
      }
    } catch {
      setFailure(true);
    }
  };
  const focusOption = (index: number) =>
    panel.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus();
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        if (value) {
          committed.current = false;
          setLayer(trigger.current?.closest<HTMLElement>('[role="dialog"]') ?? null);
          setTerm('');
        }
        setOpen(value);
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={trigger}
          type="button"
          aria-label={`${t('applicationNavigation.changeSpecification')}: ${title}`}
          className="relative block min-h-11 w-full rounded-control px-3 py-2 text-left outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          <Typography
            as="span"
            variant="body-sm"
            className="mb-1 block pr-5 text-content-muted"
            data-specification-switcher-label
          >
            {t('applicationNavigation.currentSpecification')}
          </Typography>
          <div className="min-w-0">
            <Typography
              as="span"
              variant="title-sm"
              className="block whitespace-normal text-content-primary [overflow-wrap:anywhere]"
            >
              {title}
            </Typography>
            {displayKey ? (
              <Typography as="span" variant="body-sm" className="block text-content-secondary">
                {displayKey}
              </Typography>
            ) : null}
          </div>
          <Icon
            name={ChevronsUpDown}
            size="sm"
            className="absolute right-3 top-2"
            data-specification-switcher-icon
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        inert={!open}
        aria-hidden={!open}
        ref={panel}
        container={layer}
        motion="navigation"
        aria-label={t('applicationNavigation.changeSpecification')}
        className="w-80 max-w-[calc(100vw-2rem)] p-3"
        style={layer ? { width: `${layer.clientWidth - 32}px` } : undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          search.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (committed.current)
            document.querySelector<HTMLElement>('[data-workspace-active="true"] h1')?.focus();
          else trigger.current?.focus();
        }}
      >
        <TextInput
          ref={search}
          aria-label={t('applicationNavigation.searchSpecifications')}
          value={term}
          placeholder={t('applicationNavigation.searchSpecifications')}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && entries.length) {
              e.preventDefault();
              focusOption(e.key === 'ArrowDown' ? 0 : entries.length - 1);
            }
          }}
        />
        {query.isPending ? (
          <Typography role="status" variant="body-sm">
            {t('common.loading')}
          </Typography>
        ) : null}
        {query.isError ? (
          <div className="py-2 text-body-sm" role="status">
            {t('applicationNavigation.catalogueUnavailable')}
            <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : null}
        <div
          id={listId}
          role="listbox"
          aria-label={t('applicationNavigation.specifications')}
          className="my-2 grid max-h-[min(50dvh,24rem)] gap-1 overflow-y-auto"
          aria-busy={pending}
        >
          {entries.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === specId}
              disabled={pending}
              tabIndex={index === 0 ? 0 : -1}
              className="flex min-h-11 items-start gap-2 rounded-control px-2 py-2 text-left outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring aria-selected:bg-surface-selected"
              onClick={() => void choose(item.id)}
              onKeyDown={(event) => {
                let next: number | undefined;
                if (event.key === 'ArrowDown') next = (index + 1) % entries.length;
                if (event.key === 'ArrowUp') next = (index - 1 + entries.length) % entries.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = entries.length - 1;
                if (next !== undefined) {
                  event.preventDefault();
                  focusOption(next);
                }
              }}
            >
              <span className="min-w-0 flex-1">
                <Typography
                  as="span"
                  variant="title-sm"
                  className="block whitespace-normal text-content-primary [overflow-wrap:anywhere]"
                >
                  {item.title}
                </Typography>
                {item.key ? (
                  <Typography as="span" variant="body-sm" className="block text-content-secondary">
                    {item.key}
                  </Typography>
                ) : null}
                {item.id === specId ? (
                  <Typography as="span" variant="body-sm" className="block text-content-secondary">
                    {t('applicationNavigation.selected')}
                  </Typography>
                ) : null}
              </span>
              {item.id === specId ? <Icon name="check" size="sm" /> : null}
            </button>
          ))}
        </div>
        {!entries.length && !query.isPending ? (
          <Typography role="status" variant="body-sm">
            {t('applicationNavigation.noMatches')}
          </Typography>
        ) : null}
        {failure ? (
          <Typography role="alert" variant="body-sm">
            {t('applicationNavigation.navigationFailed')}
          </Typography>
        ) : null}
        <Link
          to="/"
          search={{ collection }}
          activeOptions={{ exact: true }}
          className="block rounded-control px-2 py-2 text-body-sm text-content-primary outline-none focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          {t('applicationNavigation.browseSpecifications')}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
